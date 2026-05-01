/**
 * POST /api/employer/staff/invite-existing — bulk magic-link invite for
 * staff already in the cohort (post-CSV-import or seeded personas).
 *
 * Body: { studentIds: string[] }
 * Returns: { counts, outcomes[] } so the roster UI can render a status
 * badge per row.
 *
 * Each student must belong to the requesting admin's employer; mismatch
 * is reported as an error in that row's outcome rather than 4xx-ing the
 * whole batch.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { issueExistingUserMagicLink } from "@/lib/employer/invite-link";

const BodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(200),
});

type RowOutcome = {
  studentId: string;
  email: string | null;
  ok: boolean;
  actionLink?: string | null;
  emailDelivery?: "sent" | "skipped" | "failed";
  emailError?: string | null;
  error?: string;
};

type StudentRow = {
  id: string;
  email: string | null;
  name: string | null;
  employer_id: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  const employerId = auth.admin.employerId;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = adminSupabase();

  const { data: rowsRaw, error: studentsErr } = await supabase
    .from("students")
    .select("id, email, name, employer_id")
    .in("id", body.studentIds);
  if (studentsErr) {
    return NextResponse.json(
      { error: studentsErr.message },
      { status: 500 }
    );
  }
  const rows = (rowsRaw ?? []) as StudentRow[];
  const byId = new Map(rows.map((r) => [r.id, r] as const));

  const { data: empRow } = await supabase
    .from("employers")
    .select("name")
    .eq("id", employerId)
    .maybeSingle();
  const employerName = (empRow as { name?: string } | null)?.name ?? null;

  const origin =
    request.headers.get("origin") ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const outcomes: RowOutcome[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const studentId of body.studentIds) {
    const row = byId.get(studentId);
    if (!row) {
      outcomes.push({
        studentId,
        email: null,
        ok: false,
        error: "Student not found",
      });
      failed += 1;
      continue;
    }
    if (row.employer_id !== employerId) {
      outcomes.push({
        studentId,
        email: row.email,
        ok: false,
        error: "Not in your cohort",
      });
      failed += 1;
      continue;
    }
    if (!row.email) {
      outcomes.push({
        studentId,
        email: null,
        ok: false,
        error: "No email on file",
      });
      failed += 1;
      continue;
    }

    const result = await issueExistingUserMagicLink({
      supabase,
      email: row.email,
      inviteeName: row.name?.trim() || row.email,
      employerName,
      origin,
    });
    if (!result.ok) {
      outcomes.push({
        studentId,
        email: row.email,
        ok: false,
        error: result.error,
      });
      failed += 1;
      continue;
    }
    outcomes.push({
      studentId,
      email: row.email,
      ok: true,
      actionLink: result.actionLink,
      emailDelivery: result.emailDelivery,
      emailError: result.emailError,
    });
    if (result.emailDelivery === "sent") sent += 1;
    else if (result.emailDelivery === "failed") failed += 1;
    else skipped += 1;
  }

  console.log("[invite-existing] complete", {
    requested: body.studentIds.length,
    sent,
    failed,
    skipped,
  });

  return NextResponse.json({
    ok: true,
    counts: { sent, failed, skipped, total: body.studentIds.length },
    outcomes,
  });
}
