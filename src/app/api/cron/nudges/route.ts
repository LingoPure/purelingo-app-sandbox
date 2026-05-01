/**
 * Daily nudge cron — invoked by Vercel Cron at 06:00 SGT (23:00 UTC) and
 * also accepts a manual `Authorization: Bearer ${CRON_SECRET}` for ops
 * triggers.
 *
 * Pipeline:
 *   1. Build a snapshot of the cohort (students + average score + next class)
 *   2. Run all rules → candidates (1 per student max — rule order = priority)
 *   3. Insert as "queued" (DB unique index dedupes per UTC day)
 *   4. Send each via Resend, flip delivery_status to "sent" or "failed"
 *   5. Return a summary the cron job log can reason about
 *
 * If RESEND_API_KEY is missing, candidates land as "skipped" instead of
 * "failed" so we don't pile up alarm noise during local dev.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { evaluateAllRules, type SnapshotStudent } from "@/lib/nudges/rules";
import { sendNudgeEmail } from "@/lib/nudges/email";

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAuthorised(request: NextRequest): boolean {
  // Vercel Cron sets this header automatically.
  if (request.headers.get("x-vercel-cron") === "1") return true;
  // Manual / ops trigger.
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return runNudgeTick();
}

// GET handler so Vercel's "test cron" button + curl probes work.
export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return runNudgeTick();
}

async function runNudgeTick() {
  const supabase = adminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Gather data — students + their next scheduled class + average score.
  const [studentsRes, scoresRes, classesRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, email, name, target_level, discovery_status, streak_days, last_active_date"
      ),
    supabase.from("gap_scores").select("student_id, score"),
    supabase
      .from("classin_sessions")
      .select("student_id, scheduled_at, status")
      .in("status", ["scheduled", "live"]),
  ]);

  if (studentsRes.error) {
    return NextResponse.json(
      { error: studentsRes.error.message },
      { status: 500 }
    );
  }

  const avgByStudent = new Map<string, number>();
  for (const r of scoresRes.data ?? []) {
    const arr = avgByStudent.get(r.student_id as string) ?? 0;
    avgByStudent.set(r.student_id as string, arr + (r.score as number));
  }
  const countByStudent = new Map<string, number>();
  for (const r of scoresRes.data ?? []) {
    countByStudent.set(
      r.student_id as string,
      (countByStudent.get(r.student_id as string) ?? 0) + 1
    );
  }

  const nextClassByStudent = new Map<string, string>();
  for (const c of classesRes.data ?? []) {
    const sid = c.student_id as string;
    const t = c.scheduled_at as string | null;
    if (!t) continue;
    const cur = nextClassByStudent.get(sid);
    if (!cur || t < cur) nextClassByStudent.set(sid, t);
  }

  const snapshotStudents: SnapshotStudent[] = (studentsRes.data ?? []).map(
    (s) => {
      const sum = avgByStudent.get(s.id as string) ?? 0;
      const cnt = countByStudent.get(s.id as string) ?? 0;
      return {
        id: s.id as string,
        email: (s.email as string | null) ?? null,
        name: (s.name as string | null) ?? null,
        target_level: (s.target_level as string | null) ?? null,
        discovery_status: (s.discovery_status as string | null) ?? null,
        averageScore: cnt > 0 ? Math.round(sum / cnt) : null,
        streak_days: (s.streak_days as number | null) ?? 0,
        last_active_date: (s.last_active_date as string | null) ?? null,
        nextClassAt: nextClassByStudent.get(s.id as string) ?? null,
      };
    }
  );

  // 2. Evaluate rules.
  const candidates = evaluateAllRules({
    today,
    students: snapshotStudents,
  });

  // 3. Insert each candidate (DB unique index drops duplicates for today).
  let inserted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let dedup = 0;

  const studentById = new Map(snapshotStudents.map((s) => [s.id, s]));

  for (const cand of candidates) {
    const student = studentById.get(cand.studentId);
    if (!student?.email) {
      skipped += 1;
      continue;
    }

    const { data: row, error: insertErr } = await supabase
      .from("nudges")
      .insert({
        student_id: cand.studentId,
        rule: cand.rule,
        channel: cand.channel,
        type: cand.type,
        subject: cand.subject,
        body: cand.body,
        delivery_status: "queued",
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      // Most likely the unique-index dedup tripped. Treat as benign.
      if (/duplicate key|unique constraint/i.test(insertErr.message)) {
        dedup += 1;
        continue;
      }
      failed += 1;
      continue;
    }
    inserted += 1;

    // 4. Send. Skip without RESEND, mark sent on success, failed otherwise.
    if (!process.env.RESEND_API_KEY) {
      await supabase
        .from("nudges")
        .update({ delivery_status: "skipped" })
        .eq("id", row?.id);
      skipped += 1;
      continue;
    }
    const result = await sendNudgeEmail({
      to: student.email,
      subject: cand.subject,
      body: cand.body,
    });
    if (result.ok) {
      await supabase
        .from("nudges")
        .update({ delivery_status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row?.id);
      sent += 1;
    } else {
      console.warn(`[nudges/cron] send failed for ${student.email}: ${result.error}`);
      await supabase
        .from("nudges")
        .update({ delivery_status: "failed" })
        .eq("id", row?.id);
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    candidates: candidates.length,
    inserted,
    sent,
    failed,
    skipped,
    dedup,
  });
}
