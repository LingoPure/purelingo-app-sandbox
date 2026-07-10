"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  EmailSprintEvaluation,
  EmailSprintPrompt,
} from "@/lib/lessons/email-sprint-rubric";

type Props = {
  lessonId: string;
  prompt: EmailSprintPrompt;
  initialSubmission: string | null;
  initialEvaluation: EmailSprintEvaluation | null;
  initialXp: number;
};

const TIMER_SECS = 300; // 5 minutes

export function EmailSprintRunner({
  lessonId,
  prompt,
  initialSubmission,
  initialEvaluation,
  initialXp,
}: Props) {
  const router = useRouter();
  const [submission, setSubmission] = useState(initialSubmission ?? "");
  const [evaluation, setEvaluation] = useState<EmailSprintEvaluation | null>(
    initialEvaluation
  );
  const [xp, setXp] = useState(initialXp);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = Boolean(evaluation);
  const [secondsLeft, setSecondsLeft] = useState(
    completed ? 0 : TIMER_SECS
  );

  useEffect(() => {
    if (completed) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [completed]);

  const wordCount = submission.trim().split(/\s+/).filter(Boolean).length;

  async function handleSubmit() {
    setError(null);
    if (!submission.trim()) {
      setError("Write something first.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        xp_awarded?: number;
        evaluation?: EmailSprintEvaluation;
      };
      if (!res.ok || !body.evaluation) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setEvaluation(body.evaluation);
      setXp(body.xp_awarded ?? 0);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PromptPanel prompt={prompt} />

      {!completed && (
        <div className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Your draft
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em]">
              <span className="text-mute">
                {wordCount}/{prompt.expected_word_count} words
              </span>
              <span
                className={
                  secondsLeft < 30 && secondsLeft > 0
                    ? "text-coral"
                    : "text-mute"
                }
              >
                {formatSeconds(secondsLeft)}
              </span>
            </div>
          </div>
          <textarea
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            rows={12}
            placeholder={`Subject: ${prompt.subject_hint}\n\nHi ${prompt.recipient.split(",")[0] ?? "there"},\n\n...`}
            className="w-full rounded-md border border-cream bg-mist/40 p-3 text-sm text-ink placeholder:text-mute focus:border-navy/40 focus:outline-none"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <Link
              href="/lessons"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-navy"
            >
              ← Save and exit
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              className="rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
            >
              {pending ? "Scoring…" : "Submit for scoring"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-coral">{error}</p>
          )}
        </div>
      )}

      {completed && evaluation && (
        <ResultsPanel
          submission={submission}
          evaluation={evaluation}
          xp={xp}
        />
      )}
    </div>
  );
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function PromptPanel({ prompt }: { prompt: EmailSprintPrompt }) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Scenario · {prompt.difficulty_band}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
          ~{prompt.expected_word_count} words
        </span>
      </div>
      <p className="mb-4 leading-relaxed text-ink">{prompt.scenario}</p>
      <div className="space-y-2 border-l-2 border-gold/40 pl-4 text-sm text-ink">
        <p>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
            Task
          </span>
          <br />
          {prompt.task}
        </p>
        <p>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
            To
          </span>
          <br />
          {prompt.recipient}
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({
  evaluation,
  xp,
  submission,
}: {
  evaluation: EmailSprintEvaluation;
  xp: number;
  submission: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-teal/20 bg-teal/5 p-4">
        <span className="rounded-full border border-teal/30 bg-paper px-3 py-1 font-serif text-base text-teal">
          {evaluation.overall_band}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal">
          +{xp} XP
        </span>
        <span className="text-sm text-ink">
          Scored — your gap profile has been updated.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScoreTile
          label="Writing — formal"
          score={evaluation.writing_formal.score}
          band={evaluation.writing_formal.cefr_band}
        />
        <ScoreTile
          label="Business vocabulary"
          score={evaluation.business_vocabulary.score}
          band={evaluation.business_vocabulary.cefr_band}
        />
        <ScoreTile
          label="Reading intent"
          score={evaluation.reading_intent.score}
          band={evaluation.reading_intent.cefr_band}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FeedbackList
          heading="What worked"
          tone="positive"
          items={evaluation.strengths}
        />
        <FeedbackList
          heading="What to upgrade next"
          tone="improve"
          items={evaluation.improvements}
        />
      </div>

      <div className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Did you hit the brief?
        </p>
        <ul className="flex flex-col gap-2">
          {evaluation.hit_criteria.map((c, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={
                  c.hit
                    ? "mt-0.5 inline-block h-3 w-3 rounded-full bg-ai-green"
                    : "mt-0.5 inline-block h-3 w-3 rounded-full bg-coral"
                }
                aria-label={c.hit ? "hit" : "missed"}
              />
              <div>
                <p className="text-sm text-ink">{c.criterion}</p>
                <p className="text-xs text-mute">{c.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Your draft
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
            {submission}
          </pre>
        </div>
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Model rewrite (C1 target)
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
            {evaluation.rewrite_suggestion}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
        >
          ← Back to dashboard
        </Link>
        <Link
          href="/lessons"
          className="rounded-md border border-navy/20 px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
        >
          Try another lesson →
        </Link>
      </div>
    </div>
  );
}

function ScoreTile({
  label,
  score,
  band,
}: {
  label: string;
  score: number;
  band: string;
}) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-navy">
        {score}
        <span className="ml-1 font-mono text-xs text-mute">/1000</span>
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
        {band}
      </p>
    </div>
  );
}

function FeedbackList({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: string[];
  tone: "positive" | "improve";
}) {
  const accent = tone === "positive" ? "text-teal" : "text-gold";
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <p className={`mb-3 font-mono text-[11px] uppercase tracking-[0.22em] ${accent}`}>
        {heading}
      </p>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-ink">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
