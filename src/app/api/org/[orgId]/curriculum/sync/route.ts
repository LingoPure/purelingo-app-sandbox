import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgRole } from "@/lib/org/auth";
import { syncOrgCurricula } from "@/lib/curriculum/curriculum-reset";

/**
 * POST /api/org/[orgId]/curriculum/sync — C0 reset sweep.
 *
 * Owner/hr only. Runs the workplace-evidence reset loop for every student in
 * the org whose employer linked it. Idempotent: students with no new
 * observations or no ACTIVE plan are skipped.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ orgId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { orgId } = await ctx.params;
  const gated = await requireOrgRole(supabase, user, orgId, ["owner", "hr"]);
  if (gated instanceof NextResponse) return gated;

  const failures: Array<{ student_id: string; error: string }> = [];
  const summary = await syncOrgCurricula(createAdminClient(), orgId, {
    onError(id, err) {
      failures.push({
        student_id: id,
        error: err instanceof Error ? err.message : "unknown error",
      });
    },
  });

  return NextResponse.json({
    scanned: summary.scanned,
    resets: summary.resets,
    failures,
  });
}