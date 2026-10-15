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
import {
  evaluateAllRules,
  weekJustEndedFor,
  targetKey,
  type ProgrammeSnapshotInfo,
  type SnapshotStudent,
} from "@/lib/nudges/rules";
import { sendNudgeEmail } from "@/lib/nudges/email";

type ProgrammeSnapshotRow = {
  id: string;
  student_id: string;
  committed_at: string;
  total_weeks: number;
  phases: {
    skill_targets: {
      skill: string;
      label: string;
      kind: "micro_lesson" | "ai_voice" | "class";
      times_per_week: number;
      cta_href: string;
    }[];
  }[];
  kickoff_nudge_sent_at: string | null;
  last_cadence_nudge_week: number | null;
};

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

  // 1. Gather data — students + their next scheduled class + average score +
  //    their active programme snapshot (if any).
  const [studentsRes, scoresRes, classesRes, snapshotsRes] = await Promise.all([
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
    supabase
      .from("programme_snapshots")
      .select(
        "id, student_id, committed_at, total_weeks, phases, kickoff_nudge_sent_at, last_cadence_nudge_week"
      )
      .eq("status", "active"),
  ]);

  if (studentsRes.error) {
    return NextResponse.json(
      { error: studentsRes.error.message },
      { status: 500 }
    );
  }
  if (snapshotsRes.error) {
    return NextResponse.json(
      { error: snapshotsRes.error.message },
      { status: 500 }
    );
  }

  const snapshotRows = (snapshotsRes.data ?? []) as unknown as ProgrammeSnapshotRow[];
  const snapshotByStudent = new Map<string, ProgrammeSnapshotRow>(
    snapshotRows.map((r) => [r.student_id, r])
  );

  // For every student whose personal programme-week just closed, pull their
  // completions in that exact window — from THREE separate tables, one per
  // target kind, keyed by targetKey() (kind:skill), never skill alone. A
  // skill can carry both an ai_voice target (drilling with Aria,
  // ai_voice_tutor_sessions, status='complete' — not 'completed') and a
  // class target (classin_sessions, status='completed') at once; merging
  // them under one skill-keyed counter would let a voice drill silently
  // satisfy a class target that was never attended. A manually-scheduled
  // demo class with no focus_skill (migration 0063) can't be attributed to
  // a skill and is dropped — it was never a cadence target to begin with.
  const weeklyActivityByStudent = new Map<string, Record<string, number>>();
  for (const row of snapshotRows) {
    const weekJustEnded = weekJustEndedFor(row.committed_at, today);
    if (weekJustEnded == null) continue;

    const windowStartMs =
      new Date(row.committed_at).getTime() + (weekJustEnded - 1) * 7 * 86_400_000;
    const windowEndMs = windowStartMs + 7 * 86_400_000;
    const windowStart = new Date(windowStartMs).toISOString();
    const windowEnd = new Date(windowEndMs).toISOString();

    const [lessonsRes, voiceSessionsRes, classesInWindowRes] = await Promise.all([
      supabase
        .from("micro_lessons")
        .select("skill_focus")
        .eq("student_id", row.student_id)
        .eq("status", "completed")
        .gte("completed_at", windowStart)
        .lt("completed_at", windowEnd),
      supabase
        .from("ai_voice_tutor_sessions")
        .select("target_skill")
        .eq("student_id", row.student_id)
        .eq("status", "complete")
        .gte("completed_at", windowStart)
        .lt("completed_at", windowEnd),
      supabase
        .from("classin_sessions")
        .select("focus_skill")
        .eq("student_id", row.student_id)
        .eq("status", "completed")
        .gte("scheduled_at", windowStart)
        .lt("scheduled_at", windowEnd),
    ]);

    const byTarget: Record<string, number> = {};
    for (const l of lessonsRes.data ?? []) {
      const skill = (l as { skill_focus: string | null }).skill_focus;
      if (!skill) continue;
      const key = targetKey({ kind: "micro_lesson", skill });
      byTarget[key] = (byTarget[key] ?? 0) + 1;
    }
    for (const v of voiceSessionsRes.data ?? []) {
      const skill = (v as { target_skill: string | null }).target_skill;
      if (!skill) continue;
      const key = targetKey({ kind: "ai_voice", skill });
      byTarget[key] = (byTarget[key] ?? 0) + 1;
    }
    for (const c of classesInWindowRes.data ?? []) {
      const skill = (c as { focus_skill: string | null }).focus_skill;
      if (!skill) continue;
      const key = targetKey({ kind: "class", skill });
      byTarget[key] = (byTarget[key] ?? 0) + 1;
    }
    weeklyActivityByStudent.set(row.student_id, byTarget);
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
      const id = s.id as string;
      const sum = avgByStudent.get(id) ?? 0;
      const cnt = countByStudent.get(id) ?? 0;
      const snapshotRow = snapshotByStudent.get(id);
      const programme: ProgrammeSnapshotInfo | null = snapshotRow
        ? {
            committedAt: snapshotRow.committed_at,
            totalWeeks: snapshotRow.total_weeks,
            // Every phase carries the same skill_targets by design (see
            // programme-snapshot.ts) — phases[0] is the full set.
            skillTargets: (snapshotRow.phases[0]?.skill_targets ?? []).map((t) => ({
              skill: t.skill,
              label: t.label,
              kind: t.kind,
              timesPerWeek: t.times_per_week,
              ctaHref: t.cta_href,
            })),
            kickoffNudgeSentAt: snapshotRow.kickoff_nudge_sent_at,
            lastCadenceNudgeWeek: snapshotRow.last_cadence_nudge_week,
          }
        : null;
      return {
        id,
        email: (s.email as string | null) ?? null,
        name: (s.name as string | null) ?? null,
        target_level: (s.target_level as string | null) ?? null,
        discovery_status: (s.discovery_status as string | null) ?? null,
        averageScore: cnt > 0 ? Math.round(sum / cnt) : null,
        streak_days: (s.streak_days as number | null) ?? 0,
        last_active_date: (s.last_active_date as string | null) ?? null,
        nextClassAt: nextClassByStudent.get(id) ?? null,
        programme,
        lastCompletedWeekByTarget: weeklyActivityByStudent.get(id) ?? null,
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
      ctaHref: cand.ctaHref,
      ctaLabel: cand.ctaLabel,
    });
    if (result.ok) {
      await supabase
        .from("nudges")
        .update({ delivery_status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row?.id);
      sent += 1;

      // One-time markers so these two rules don't re-fire. Written back
      // only on a confirmed send, same posture as delivery_status above.
      if (cand.rule === "programme_kickoff") {
        await supabase
          .from("programme_snapshots")
          .update({ kickoff_nudge_sent_at: new Date().toISOString() })
          .eq("student_id", cand.studentId)
          .eq("status", "active");
      } else if (cand.rule === "programme_cadence_behind") {
        const snapshotRow = snapshotByStudent.get(cand.studentId);
        const weekJustEnded = snapshotRow
          ? weekJustEndedFor(snapshotRow.committed_at, today)
          : null;
        if (weekJustEnded != null) {
          await supabase
            .from("programme_snapshots")
            .update({ last_cadence_nudge_week: weekJustEnded })
            .eq("student_id", cand.studentId)
            .eq("status", "active");
        }
      }
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
