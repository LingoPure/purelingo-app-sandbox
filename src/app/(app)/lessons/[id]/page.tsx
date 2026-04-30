import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmailSprintRunner } from "./email-sprint-runner";
import { SpeakScoreRunner } from "./speak-score-runner";
import type {
  EmailSprintEvaluation,
  EmailSprintPrompt,
} from "@/lib/lessons/email-sprint-rubric";
import type {
  SpeakScoreEvaluation,
  SpeakScorePrompt,
} from "@/lib/lessons/speak-score-rubric";

type EmailSprintRow = {
  id: string;
  type: "email_sprint";
  status: string | null;
  xp_awarded: number | null;
  content_json: {
    prompt?: EmailSprintPrompt;
    submission?: string;
    evaluation?: EmailSprintEvaluation;
  } | null;
};

type SpeakScoreRow = {
  id: string;
  type: "speak_score";
  status: string | null;
  xp_awarded: number | null;
  content_json: {
    prompt?: SpeakScorePrompt;
    transcript?: string;
    evaluation?: SpeakScoreEvaluation;
  } | null;
};

type LessonRow = EmailSprintRow | SpeakScoreRow | {
  id: string;
  type: string;
  status: string | null;
  xp_awarded: number | null;
  content_json: unknown;
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("micro_lessons")
    .select("id, type, status, xp_awarded, content_json")
    .eq("id", id)
    .maybeSingle<LessonRow>();

  if (!data) notFound();

  if (data.type === "email_sprint") {
    const lesson = data as EmailSprintRow;
    const prompt = lesson.content_json?.prompt;
    if (!prompt) return <CorruptedShell />;
    return (
      <LessonShell heading={prompt.subject_hint} kicker="Email sprint">
        <EmailSprintRunner
          lessonId={lesson.id}
          prompt={prompt}
          initialSubmission={lesson.content_json?.submission ?? null}
          initialEvaluation={lesson.content_json?.evaluation ?? null}
          initialXp={lesson.xp_awarded ?? 0}
        />
      </LessonShell>
    );
  }

  if (data.type === "speak_score") {
    const lesson = data as SpeakScoreRow;
    const prompt = lesson.content_json?.prompt;
    if (!prompt) return <CorruptedShell />;
    return (
      <LessonShell
        heading={truncate(prompt.task, 80)}
        kicker="Speak & score"
      >
        <SpeakScoreRunner
          lessonId={lesson.id}
          prompt={prompt}
          initialEvaluation={lesson.content_json?.evaluation ?? null}
          initialTranscript={lesson.content_json?.transcript ?? null}
          initialXp={lesson.xp_awarded ?? 0}
        />
      </LessonShell>
    );
  }

  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <p className="text-sm text-mute">
        Lesson type{" "}
        <code className="font-mono text-xs">{data.type}</code> is not yet
        rendered. <Link href="/lessons" className="underline">Back</Link>
      </p>
    </div>
  );
}

function LessonShell({
  heading,
  kicker,
  children,
}: {
  heading: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            {kicker}
          </p>
          <h1 className="font-serif text-2xl text-navy">{heading}</h1>
        </div>
        <Link
          href="/lessons"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
        >
          ← Lessons
        </Link>
      </div>
      {children}
    </div>
  );
}

function CorruptedShell() {
  return (
    <div className="rounded-lg border border-coral/30 bg-coral/5 p-6">
      <p className="text-sm text-coral">
        This lesson is missing its generated prompt. It may have failed mid-creation.
      </p>
      <Link
        href="/lessons"
        className="mt-3 inline-block font-mono text-xs uppercase tracking-[0.22em] text-navy hover:underline"
      >
        ← Back to lessons
      </Link>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
