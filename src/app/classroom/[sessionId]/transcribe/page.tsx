// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
/**
 * Demo path for exercising the post-session scoring pipeline before EEO ships
 * ClassIn SDK credentials. The tester pastes a session transcript, submits,
 * and gets routed back to the dashboard with updated gap_scores
 * (source='session') + a participation summary on the classin_sessions row.
 *
 * Disappears once real ClassIn analytics + recording-download are wired —
 * by then the pipeline runs automatically off the session-end webhook.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TranscribeForm } from "./transcribe-form";

export default async function TranscribePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/classroom/${sessionId}/transcribe`);

  const { data: session } = await supabase
    .from("classin_sessions")
    .select("id, classin_class_id, teacher_name, scheduled_at, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const teacher = session.teacher_name ?? "your coach";
  const when = session.scheduled_at
    ? new Date(session.scheduled_at).toLocaleString("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-paper"
        >
          ← Dashboard
        </Link>
      </div>

      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Post-session scoring · demo path
        </p>
        <h1 className="font-serif text-3xl text-paper">
          Score this class with a transcript
        </h1>
        <p className="mt-2 text-sm text-mute">
          Class with {teacher}
          {when ? ` · ${when}` : ""}. Paste the session transcript below — Whisper
          + Claude will run the scoring rubric and update your gap profile within
          ~10 seconds.
        </p>
      </div>

      <TranscribeForm sessionId={sessionId} />

      <p className="text-xs text-mute">
        This page exists for the demo. Once ClassIn SDK credentials are in place,
        the post-session pipeline runs automatically from the session-end webhook
        — no transcript paste required.
      </p>
    </div>
  );
}
