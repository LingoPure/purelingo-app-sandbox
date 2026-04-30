import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmailSprintRunner } from "./email-sprint-runner";
import type {
  EmailSprintEvaluation,
  EmailSprintPrompt,
} from "@/lib/lessons/email-sprint-rubric";

type LessonRow = {
  id: string;
  type: string;
  status: string | null;
  xp_awarded: number | null;
  content_json: {
    prompt?: EmailSprintPrompt;
    submission?: string;
    evaluation?: EmailSprintEvaluation;
  } | null;
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS gates this to lessons owned by the signed-in student.
  const { data: lesson } = await supabase
    .from("micro_lessons")
    .select("id, type, status, xp_awarded, content_json")
    .eq("id", id)
    .maybeSingle<LessonRow>();

  if (!lesson) notFound();

  if (lesson.type !== "email_sprint") {
    return (
      <div className="rounded-lg border border-cream bg-paper p-6">
        <p className="text-sm text-mute">
          Lesson type{" "}
          <code className="font-mono text-xs">{lesson.type}</code> is not yet
          rendered. <Link href="/lessons" className="underline">Back</Link>
        </p>
      </div>
    );
  }

  const prompt = lesson.content_json?.prompt;
  if (!prompt) {
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Email sprint
          </p>
          <h1 className="font-serif text-2xl text-navy">
            {prompt.subject_hint}
          </h1>
        </div>
        <Link
          href="/lessons"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
        >
          ← Lessons
        </Link>
      </div>

      <EmailSprintRunner
        lessonId={lesson.id}
        prompt={prompt}
        initialSubmission={lesson.content_json?.submission ?? null}
        initialEvaluation={lesson.content_json?.evaluation ?? null}
        initialXp={lesson.xp_awarded ?? 0}
      />
    </div>
  );
}
