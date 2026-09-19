"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  TaskPromptPublic,
  TaskType,
} from "@/lib/onboarding/battery/types";
import type { SelectedTask } from "@/lib/onboarding/battery/select-tasks";

import { BilingualText } from "@/components/i18n/bilingual-text";
import type { Bilingual } from "@/lib/i18n/translate";

export type LoadedTask = {
  prompt_id: string;
  variant_bucket: string;
  prompt: TaskPromptPublic;
};

type Props = {
  tasks: LoadedTask[];
  /** Per-task selection metadata produced by selectTasksForStudent —
   *  used to surface "why this task" in the intro screen. Optional;
   *  if missing the intro renders a generic blurb. */
  selected?: SelectedTask[];
  bIntro?: Bilingual[];
};

const TASK_LABELS: Record<
  TaskType,
  { num: string; label: string; mins: string; minutes: number; measures: string }
> = {
  email_writing: {
    num: "1",
    label: "Email writing",
    mins: "~5 min",
    minutes: 5,
    measures:
      "Direct measurement of business writing — register, structure, strategic content, and lexical range.",
  },
  listen_paraphrase: {
    num: "2",
    label: "Listen & paraphrase",
    mins: "~3 min",
    minutes: 3,
    measures:
      "Active listening — recall, inference of implications, and capture of action items from a 30-45 second clip.",
  },
  read_summarise: {
    num: "3",
    label: "Read & summarise",
    mins: "~4 min",
    minutes: 4,
    measures:
      "Reading comprehension AND subtext detection — does the student spot the buried question hidden behind hedge language?",
  },
  vocab_cloze: {
    num: "4",
    label: "Vocabulary at register",
    mins: "~3 min",
    minutes: 3,
    measures:
      "Register-aware word choice — picking the right business-English collocation when several near-synonyms compete.",
  },
};

type Phase = "intro" | "tasks" | "review" | "submitting" | "done";

type StoredResponse = {
  task_prompt_id: string;
  task_type: TaskType;
  payload: unknown;
};

export function BatteryRunner({ tasks, selected, bIntro }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [activeIdx, setActiveIdx] = useState(0);
  const [responses, setResponses] = useState<Record<number, StoredResponse>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  const active = tasks[activeIdx];

  function reasonFor(taskType: TaskType): string | null {
    return selected?.find((s) => s.taskType === taskType)?.reason ?? null;
  }

  // Per-task "Save and continue" — stores the answer in state and
  // advances. No network call yet; the final "Submit all" at the review
  // screen is the single trigger for the unified scoring + gap analysis.
  function handleSave(payload: unknown) {
    setError(null);
    setResponses((prev) => ({
      ...prev,
      [activeIdx]: {
        task_prompt_id: active.prompt_id,
        task_type: active.prompt.task_type,
        payload,
      },
    }));
    if (activeIdx >= tasks.length - 1) {
      setPhase("review");
    } else {
      setActiveIdx((i) => i + 1);
    }
  }

  async function handleSubmitAll() {
    setPhase("submitting");
    setError(null);
    const ordered = tasks.map((_, idx) => responses[idx]).filter(Boolean) as StoredResponse[];
    if (ordered.length !== tasks.length) {
      setError("Some tasks have no recorded answer — go back and complete them.");
      setPhase("review");
      return;
    }

    type SubmitOutcome = {
      ok: boolean;
      task_type: TaskType;
      error?: string;
    };
    let outcomes: SubmitOutcome[] = [];
    try {
      outcomes = await Promise.all(
        ordered.map(async (r): Promise<SubmitOutcome> => {
          const res = await fetch("/api/onboarding/battery/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_prompt_id: r.task_prompt_id,
              task_type: r.task_type,
              response: r.payload,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
          };
          return {
            ok: res.ok && Boolean(data.ok),
            task_type: r.task_type,
            error: data.error,
          };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("review");
      return;
    }

    const failed = outcomes.filter((o) => !o.ok);
    if (failed.length > 0) {
      setError(
        `Failed to submit ${failed.length} task(s): ${failed
          .map((f) => `${TASK_LABELS[f.task_type].label}${f.error ? ` — ${f.error}` : ""}`)
          .join("; ")}. Try again.`
      );
      setPhase("review");
      return;
    }

    setPhase("done");
    router.push("/plan");
  }

  if (phase === "intro") {
    return <BatteryIntro tasks={tasks} selected={selected} bIntro={bIntro} onStart={() => setPhase("tasks")} />;
  }

  if (phase === "review") {
    return (
      <BatteryReview
        tasks={tasks}
        responses={responses}
        error={error}
        onEditTask={(idx) => {
          setActiveIdx(idx);
          setPhase("tasks");
          setError(null);
        }}
        onSubmitAll={handleSubmitAll}
      />
    );
  }

  if (phase === "submitting") {
    return (
      <div className="rounded-lg border border-gold/30 bg-gold/5 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">
          Submitting all assessments
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          Triggering your full gap analysis…
        </h2>
        <p className="mt-2 text-sm text-mute">
          Your responses are being scored in parallel. You&apos;ll land on your
          personalised programme in a moment — your scores will be ready.
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal">
          Assessment complete
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          Taking you to your programme…
        </h2>
      </div>
    );
  }

  // phase === "tasks"
  const reason = reasonFor(active.prompt.task_type);
  const submitting = false; // task buttons stay enabled in the new flow
  return (
    <div className="flex flex-col gap-6">
      <ProgressRail tasks={tasks} activeIdx={activeIdx} />

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Task {activeIdx + 1} of {tasks.length}
              {" · "}
              {TASK_LABELS[active.prompt.task_type].mins}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-navy">
              {TASK_LABELS[active.prompt.task_type].label}
            </h2>
            {reason && (
              <p className="mt-1 text-xs italic text-mute">Why this task: {reason}</p>
            )}
          </div>
        </div>

        {active.prompt.task_type === "email_writing" && (
          <EmailWritingTask
            data={active.prompt.data}
            disabled={submitting}
            initial={responses[activeIdx]?.payload}
            onSave={handleSave}
            isLast={activeIdx === tasks.length - 1}
          />
        )}
        {active.prompt.task_type === "listen_paraphrase" && (
          <ListenParaphraseTask
            data={active.prompt.data}
            disabled={submitting}
            initial={responses[activeIdx]?.payload}
            onSave={handleSave}
            isLast={activeIdx === tasks.length - 1}
          />
        )}
        {active.prompt.task_type === "read_summarise" && (
          <ReadSummariseTask
            data={active.prompt.data}
            disabled={submitting}
            initial={responses[activeIdx]?.payload}
            onSave={handleSave}
            isLast={activeIdx === tasks.length - 1}
          />
        )}
        {active.prompt.task_type === "vocab_cloze" && (
          <VocabClozeTask
            data={active.prompt.data}
            disabled={submitting}
            initial={responses[activeIdx]?.payload}
            onSave={handleSave}
            isLast={activeIdx === tasks.length - 1}
          />
        )}

        {error && (
          <p className="mt-4 rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

// ─── Intro screen ────────────────────────────────────────────────────────────

function BatteryIntro({
  tasks,
  selected,
  bIntro,
  onStart,
}: {
  tasks: LoadedTask[];
  selected?: SelectedTask[];
  bIntro?: Bilingual[];
  onStart: () => void;
}) {
  const totalMinutes = tasks.reduce(
    (sum, t) => sum + TASK_LABELS[t.prompt.task_type].minutes,
    0
  );
  const bKicker = bIntro?.[0] ?? { en: "Voice discovery complete", native: "Voice discovery complete", translated: false };
  const bTitle = bIntro?.[1] ?? { en: "Now we measure the rest — directly", native: "Now we measure the rest — directly", translated: false };
  const bBody = bIntro?.[2] ?? { en: "Aria heard you speak. The voice conversation is great for fluency, comprehension, and learning style — but it can't directly measure how you write business emails, how you read for subtext, or how precisely you pick words. These short tasks fill those gaps. Together they produce the full profile your employer sees.", native: "", translated: false };
  const bStartCta = bIntro?.[5] ?? { en: "Start the assessment →", native: "Start the assessment →", translated: false };

  return (
    <section className="flex flex-col gap-6 rounded-lg border border-cream bg-paper p-6 sm:p-8">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          <BilingualText text={bKicker} />
        </div>
        <div className="mt-1 font-serif text-2xl text-navy">
          <BilingualText text={bTitle} />
        </div>
        <div className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          <BilingualText text={bBody} />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {tasks.map((t, i) => {
          const meta = TASK_LABELS[t.prompt.task_type];
          const reason = selected?.find(
            (s) => s.taskType === t.prompt.task_type
          )?.reason;
          return (
            <li
              key={t.prompt_id}
              className="flex gap-4 rounded-md border border-cream bg-mist/30 p-4"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy font-mono text-xs text-paper">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-serif text-base text-navy">
                  {meta.label}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                    {meta.mins}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-ink">{meta.measures}</p>
                {reason && (
                  <p className="text-xs italic text-mute">Why for you: {reason}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream pt-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          Total time: ~{totalMinutes} min · One submission at the end triggers
          the full gap analysis
        </p>
        <button
          type="button"
          onClick={onStart}
          className="rounded-md bg-navy px-6 py-3 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          {bStartCta?.translated ? <BilingualText text={bStartCta} /> : "Start the assessment →"}
        </button>
      </div>
    </section>
  );
}

// ─── Review screen ───────────────────────────────────────────────────────────

function BatteryReview({
  tasks,
  responses,
  error,
  onEditTask,
  onSubmitAll,
}: {
  tasks: LoadedTask[];
  responses: Record<number, StoredResponse>;
  error: string | null;
  onEditTask: (idx: number) => void;
  onSubmitAll: () => void;
}) {
  const allComplete = tasks.every((_, idx) => responses[idx]);
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-cream bg-paper p-6 sm:p-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Review and submit
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          Ready to trigger your full gap analysis
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Submitting now scores all tasks together and reconciles the results
          with your voice profile into a single canonical gap analysis your
          employer will see.
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {tasks.map((t, idx) => {
          const meta = TASK_LABELS[t.prompt.task_type];
          const stored = responses[idx];
          return (
            <li
              key={t.prompt_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cream bg-mist/30 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-xs text-paper">
                  ✓
                </span>
                <div>
                  <p className="font-serif text-sm text-navy">{meta.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                    {summariseStored(t.prompt.task_type, stored)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEditTask(idx)}
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
              >
                Edit
              </button>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-cream pt-4">
        <button
          type="button"
          onClick={onSubmitAll}
          disabled={!allComplete}
          className="rounded-md bg-navy px-6 py-3 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit all assessments →
        </button>
      </div>
    </section>
  );
}

function summariseStored(
  taskType: TaskType,
  stored?: StoredResponse
): string {
  if (!stored) return "Not answered yet";
  const p = stored.payload as Record<string, unknown>;
  if (taskType === "email_writing") {
    const wc = (p?.word_count as number) ?? 0;
    return `${wc} word${wc === 1 ? "" : "s"} written`;
  }
  if (taskType === "listen_paraphrase") {
    const points = (p?.points as string[] | undefined) ?? [];
    const plays = (p?.plays_used as number) ?? 0;
    return `${points.length} point${points.length === 1 ? "" : "s"} captured · ${plays} play${plays === 1 ? "" : "s"} used`;
  }
  if (taskType === "read_summarise") {
    const summary = (p?.summary as string | undefined) ?? "";
    const wc = summary.trim().length === 0 ? 0 : summary.trim().split(/\s+/).length;
    return `${wc}-word summary`;
  }
  // vocab_cloze
  const answers = (p?.answers as { selected: string }[] | undefined) ?? [];
  return `${answers.length} item${answers.length === 1 ? "" : "s"} answered`;
}

// ─── Progress rail ───────────────────────────────────────────────────────────

function ProgressRail({
  tasks,
  activeIdx,
}: {
  tasks: LoadedTask[];
  activeIdx: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm">
      {tasks.map((t, i) => {
        const meta = TASK_LABELS[t.prompt.task_type];
        const state =
          i < activeIdx ? "done" : i === activeIdx ? "active" : "upcoming";
        return (
          <li key={t.prompt_id} className="flex items-center gap-2">
            <span
              className={
                "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] " +
                (state === "done"
                  ? "bg-teal text-paper"
                  : state === "active"
                    ? "bg-navy text-paper"
                    : "border border-cream bg-paper text-mute")
              }
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={
                "font-mono text-[11px] uppercase tracking-[0.22em] " +
                (state === "active" ? "text-navy" : "text-mute")
              }
            >
              {meta.label}
            </span>
            {i < tasks.length - 1 && (
              <span className="hidden h-px w-8 bg-cream sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Task 1: email writing ──────────────────────────────────────────────────

type EmailWritingData = Extract<TaskPromptPublic, { task_type: "email_writing" }>["data"];

function EmailWritingTask({
  data,
  disabled,
  initial,
  onSave,
  isLast,
}: {
  data: EmailWritingData;
  disabled: boolean;
  initial?: unknown;
  onSave: (payload: unknown) => void;
  isLast: boolean;
}) {
  const initialText =
    typeof initial === "object" && initial !== null && "text" in initial
      ? String((initial as { text: unknown }).text ?? "")
      : "";
  const [text, setText] = useState(initialText);
  const startedAtRef = useRef(0);
  const keystrokesRef = useRef(0);
  const pasteCountRef = useRef(0);

  // One-time timestamp init on mount. The component re-mounts whenever
  // activeIdx changes (each task type renders a different component),
  // so we don't need a reset-on-data-change effect.
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const wordCount = useMemo(
    () => (text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length),
    [text]
  );
  const inRange =
    wordCount >= data.target_word_count.min &&
    wordCount <= data.target_word_count.max;

  function save() {
    onSave({
      text,
      word_count: wordCount,
      paste_count: pasteCountRef.current,
      total_keystrokes: keystrokesRef.current,
      total_seconds: (Date.now() - startedAtRef.current) / 1000,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md bg-mist/40 p-4 text-sm leading-relaxed text-ink">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          Scenario
        </p>
        <p>{data.scenario}</p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          Persona
        </p>
        <p className="text-xs italic text-mute">{data.persona}</p>
      </div>
      <p className="text-sm text-mute">{data.instructions}</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          keystrokesRef.current += 1;
        }}
        onPaste={() => {
          pasteCountRef.current += 1;
        }}
        rows={12}
        placeholder="Type your email reply here…"
        className="w-full rounded-md border border-cream bg-paper px-4 py-3 text-sm text-ink focus:border-navy focus:outline-none"
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className={
            "font-mono text-xs " + (inRange ? "text-teal" : "text-mute")
          }
        >
          {wordCount} word{wordCount === 1 ? "" : "s"} (target{" "}
          {data.target_word_count.min}–{data.target_word_count.max})
        </p>
        <button
          type="button"
          onClick={save}
          disabled={disabled || wordCount < 30}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "Save and review →" : "Save and continue →"}
        </button>
      </div>
    </div>
  );
}

// ─── Task 2: listen & paraphrase ────────────────────────────────────────────

type ListenData = Extract<TaskPromptPublic, { task_type: "listen_paraphrase" }>["data"];

function ListenParaphraseTask({
  data,
  disabled,
  initial,
  onSave,
  isLast,
}: {
  data: ListenData;
  disabled: boolean;
  initial?: unknown;
  onSave: (payload: unknown) => void;
  isLast: boolean;
}) {
  const initialPoints =
    typeof initial === "object" && initial !== null && "points" in initial
      ? ((initial as { points: unknown }).points as string[])
      : null;
  const initialPlays =
    typeof initial === "object" && initial !== null && "plays_used" in initial
      ? Number((initial as { plays_used: unknown }).plays_used) || 0
      : 0;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playsUsed, setPlaysUsed] = useState(initialPlays);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [points, setPoints] = useState<string[]>(
    initialPoints && initialPoints.length === 3
      ? initialPoints
      : initialPoints
        ? [
            initialPoints[0] ?? "",
            initialPoints[1] ?? "",
            initialPoints[2] ?? "",
          ]
        : ["", "", ""]
  );
  const playsAllowed = data.plays_allowed ?? 1;
  const canPlay = playsUsed < playsAllowed && !playing;

  function play() {
    const a = audioRef.current;
    if (!a) return;
    setAudioError(null);
    a.currentTime = 0;
    setPlaying(true);
    a.play().catch((err) => {
      setPlaying(false);
      setAudioError(
        err instanceof Error
          ? `Audio playback failed — ${err.message}`
          : "Audio playback failed"
      );
    });
  }

  function save() {
    const cleaned = points.map((p) => p.trim()).filter((p) => p.length > 0);
    if (cleaned.length < 1) return;
    onSave({ points: cleaned, plays_used: playsUsed });
  }

  const filled = points.filter((p) => p.trim().length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute">{data.instructions}</p>

      {data.audio_url && (
        <audio
          ref={audioRef}
          src={data.audio_url}
          preload="auto"
          onEnded={() => {
            setPlaying(false);
            setPlaysUsed((n) => n + 1);
          }}
          onError={() =>
            setAudioError("Audio failed to load. Try refreshing the page.")
          }
          className="hidden"
        />
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-md bg-mist/40 p-4">
        <button
          type="button"
          onClick={play}
          disabled={disabled || !canPlay}
          className="rounded-full bg-navy px-5 py-2 font-mono text-xs uppercase tracking-[0.22em] text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {playing ? "Playing…" : playsUsed === 0 ? "Play voicemail" : "Replay"}
        </button>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          {playsUsed}/{playsAllowed} play{playsAllowed === 1 ? "" : "s"} used
        </p>
      </div>

      {audioError && (
        <p className="rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
          {audioError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
          Three key points (in your own words)
        </p>
        {points.map((p, i) => (
          <input
            key={i}
            value={p}
            onChange={(e) => {
              const next = [...points];
              next[i] = e.target.value;
              setPoints(next);
            }}
            placeholder={`Point ${i + 1}`}
            disabled={disabled || playsUsed === 0}
            className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none"
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-mute">
          {filled}/3 point{filled === 1 ? "" : "s"} filled
        </p>
        <button
          type="button"
          onClick={save}
          disabled={disabled || filled < 1 || playsUsed === 0}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "Save and review →" : "Save and continue →"}
        </button>
      </div>
    </div>
  );
}

// ─── Task 3: read & summarise ───────────────────────────────────────────────

type ReadData = Extract<TaskPromptPublic, { task_type: "read_summarise" }>["data"];

function ReadSummariseTask({
  data,
  disabled,
  initial,
  onSave,
  isLast,
}: {
  data: ReadData;
  disabled: boolean;
  initial?: unknown;
  onSave: (payload: unknown) => void;
  isLast: boolean;
}) {
  const initialSummary =
    typeof initial === "object" && initial !== null && "summary" in initial
      ? String((initial as { summary: unknown }).summary ?? "")
      : "";
  const [summary, setSummary] = useState(initialSummary);
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  function save() {
    onSave({
      summary,
      total_seconds: (Date.now() - startedAtRef.current) / 1000,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute">{data.instructions}</p>
      <article className="whitespace-pre-line rounded-md border border-cream bg-mist/30 p-4 text-sm leading-relaxed text-ink">
        {data.body}
      </article>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={6}
        placeholder="Your 3-4 sentence summary…"
        className="w-full rounded-md border border-cream bg-paper px-4 py-3 text-sm text-ink focus:border-navy focus:outline-none"
        disabled={disabled}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={disabled || summary.trim().length < 30}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "Save and review →" : "Save and continue →"}
        </button>
      </div>
    </div>
  );
}

// ─── Task 4: vocab cloze ────────────────────────────────────────────────────

type VocabData = Extract<TaskPromptPublic, { task_type: "vocab_cloze" }>["data"];

function VocabClozeTask({
  data,
  disabled,
  initial,
  onSave,
  isLast,
}: {
  data: VocabData;
  disabled: boolean;
  initial?: unknown;
  onSave: (payload: unknown) => void;
  isLast: boolean;
}) {
  const initialAnswers =
    typeof initial === "object" && initial !== null && "answers" in initial
      ? ((initial as { answers: { item_id: string; selected: string }[] }).answers ?? [])
      : [];
  const initialMap: Record<string, string> = Object.fromEntries(
    initialAnswers.map((a) => [a.item_id, a.selected])
  );
  const [answers, setAnswers] = useState<Record<string, string>>(initialMap);
  const startsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const init: Record<string, number> = {};
    for (const item of data.items) init[item.id] = Date.now();
    startsRef.current = init;
  }, [data]);

  function pick(itemId: string, choice: string) {
    setAnswers((prev) => ({ ...prev, [itemId]: choice }));
  }

  function save() {
    const now = Date.now();
    const payload = {
      answers: data.items.map((item) => ({
        item_id: item.id,
        selected: answers[item.id] ?? "",
        time_taken_ms: Math.max(0, now - (startsRef.current[item.id] ?? now)),
      })),
    };
    onSave(payload);
  }

  const answered = Object.keys(answers).length;
  const allAnswered = answered === data.items.length;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-mute">{data.instructions}</p>
      <ol className="flex flex-col gap-4">
        {data.items.map((item, idx) => {
          const chosen = answers[item.id];
          return (
            <li
              key={item.id}
              className="rounded-md border border-cream bg-mist/30 p-4"
            >
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
                Item {idx + 1} of {data.items.length}
              </p>
              <p className="mb-3 text-sm text-ink">
                {item.stem.replace("____", "_______")}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.options.map((opt) => {
                  const selected = chosen === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => pick(item.id, opt)}
                      disabled={disabled}
                      className={
                        "rounded-full border px-3 py-1 font-mono text-xs " +
                        (selected
                          ? "border-navy bg-navy text-paper"
                          : "border-cream bg-paper text-navy hover:bg-mist/40")
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-mute">
          {answered}/{data.items.length} answered
        </p>
        <button
          type="button"
          onClick={save}
          disabled={disabled || !allAnswered}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLast ? "Save and review →" : "Save and continue →"}
        </button>
      </div>
    </div>
  );
}
