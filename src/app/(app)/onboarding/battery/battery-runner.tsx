"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  TaskPromptPublic,
  TaskType,
} from "@/lib/onboarding/battery/types";

export type LoadedTask = {
  prompt_id: string;
  variant_bucket: string;
  prompt: TaskPromptPublic;
};

type Props = {
  tasks: LoadedTask[];
};

const TASK_LABELS: Record<TaskType, { num: string; label: string; mins: string }> = {
  email_writing: { num: "1", label: "Email writing", mins: "~5 min" },
  listen_paraphrase: { num: "2", label: "Listen & paraphrase", mins: "~3 min" },
  read_summarise: { num: "3", label: "Read & summarise", mins: "~4 min" },
  vocab_cloze: { num: "4", label: "Vocabulary at register", mins: "~3 min" },
};

export function BatteryRunner({ tasks }: Props) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const active = tasks[activeIdx];
  const isLast = activeIdx === tasks.length - 1;

  function handleSubmit(payload: unknown) {
    setError(null);
    startSubmit(async () => {
      const res = await fetch("/api/onboarding/battery/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_prompt_id: active.prompt_id,
          task_type: active.prompt.task_type,
          response: payload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Submit failed (${res.status})`);
        return;
      }
      if (isLast) {
        setDone(true);
        // Land on the dashboard so the polling banner picks up the
        // canonical battery scores as they finish reconciling.
        router.push("/dashboard?just-finished=battery");
      } else {
        setActiveIdx((i) => i + 1);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-teal">
          Battery complete
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          Heading to your dashboard…
        </h2>
        <p className="mt-2 text-sm text-mute">
          Your gap profile is being finalised. The dashboard will refresh as each
          score lands.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressRail tasks={tasks} activeIdx={activeIdx} />

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Task {TASK_LABELS[active.prompt.task_type].num} of {tasks.length}
              {" · "}
              {TASK_LABELS[active.prompt.task_type].mins}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-navy">
              {TASK_LABELS[active.prompt.task_type].label}
            </h2>
          </div>
        </div>

        {active.prompt.task_type === "email_writing" && (
          <EmailWritingTask
            data={active.prompt.data}
            disabled={submitting}
            onSubmit={handleSubmit}
          />
        )}
        {active.prompt.task_type === "listen_paraphrase" && (
          <ListenParaphraseTask
            data={active.prompt.data}
            disabled={submitting}
            onSubmit={handleSubmit}
          />
        )}
        {active.prompt.task_type === "read_summarise" && (
          <ReadSummariseTask
            data={active.prompt.data}
            disabled={submitting}
            onSubmit={handleSubmit}
          />
        )}
        {active.prompt.task_type === "vocab_cloze" && (
          <VocabClozeTask
            data={active.prompt.data}
            disabled={submitting}
            onSubmit={handleSubmit}
          />
        )}

        {error && (
          <p className="mt-4 rounded-md border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
            {error}
          </p>
        )}
        {submitting && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Submitting…
          </p>
        )}
      </section>
    </div>
  );
}

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
              {state === "done" ? "✓" : meta.num}
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
  onSubmit,
}: {
  data: EmailWritingData;
  disabled: boolean;
  onSubmit: (payload: unknown) => void;
}) {
  const [text, setText] = useState("");
  const startedAtRef = useRef(0);
  const keystrokesRef = useRef(0);
  const pasteCountRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    keystrokesRef.current = 0;
    pasteCountRef.current = 0;
  }, [data]);

  const wordCount = useMemo(
    () => (text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length),
    [text]
  );
  const inRange =
    wordCount >= data.target_word_count.min &&
    wordCount <= data.target_word_count.max;

  function submit() {
    onSubmit({
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
          onClick={submit}
          disabled={disabled || wordCount < 30}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit and continue →
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
  onSubmit,
}: {
  data: ListenData;
  disabled: boolean;
  onSubmit: (payload: unknown) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playsUsed, setPlaysUsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [points, setPoints] = useState<string[]>(["", "", ""]);
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

  function submit() {
    const cleaned = points.map((p) => p.trim()).filter((p) => p.length > 0);
    if (cleaned.length < 1) return;
    onSubmit({ points: cleaned, plays_used: playsUsed });
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
          onClick={submit}
          disabled={disabled || filled < 1 || playsUsed === 0}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit and continue →
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
  onSubmit,
}: {
  data: ReadData;
  disabled: boolean;
  onSubmit: (payload: unknown) => void;
}) {
  const [summary, setSummary] = useState("");
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, [data]);

  function submit() {
    onSubmit({
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
          onClick={submit}
          disabled={disabled || summary.trim().length < 30}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit and continue →
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
  onSubmit,
}: {
  data: VocabData;
  disabled: boolean;
  onSubmit: (payload: unknown) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const startsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const init: Record<string, number> = {};
    for (const item of data.items) init[item.id] = Date.now();
    startsRef.current = init;
  }, [data]);

  function pick(itemId: string, choice: string) {
    setAnswers((prev) => ({ ...prev, [itemId]: choice }));
  }

  function submit() {
    const now = Date.now();
    const payload = {
      answers: data.items.map((item) => ({
        item_id: item.id,
        selected: answers[item.id] ?? "",
        time_taken_ms: Math.max(0, now - (startsRef.current[item.id] ?? now)),
      })),
    };
    onSubmit(payload);
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
          onClick={submit}
          disabled={disabled || !allAnswered}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit and finish →
        </button>
      </div>
    </div>
  );
}
