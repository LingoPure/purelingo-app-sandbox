"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  SpeakScoreEvaluation,
  SpeakScorePrompt,
} from "@/lib/lessons/speak-score-rubric";

type Props = {
  lessonId: string;
  prompt: SpeakScorePrompt;
  initialEvaluation: SpeakScoreEvaluation | null;
  initialTranscript: string | null;
  initialXp: number;
};

type RecorderState = "idle" | "recording" | "stopped" | "submitting";

export function SpeakScoreRunner({
  lessonId,
  prompt,
  initialEvaluation,
  initialTranscript,
  initialXp,
}: Props) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState<SpeakScoreEvaluation | null>(
    initialEvaluation
  );
  const [transcript, setTranscript] = useState<string | null>(
    initialTranscript
  );
  const [xp, setXp] = useState(initialXp);
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [secondsRecorded, setSecondsRecorded] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);

  const completed = Boolean(evaluation);
  const maxSeconds = prompt.expected_seconds + 30;

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Auto-stop when hitting hard cap.
  useEffect(() => {
    if (state === "recording" && secondsRecorded >= maxSeconds) {
      stopRecording();
    }
  }, [state, secondsRecorded, maxSeconds]);

  async function startRecording() {
    setError(null);
    setSecondsRecorded(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState("stopped");
        if (tickRef.current) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
      };

      recorder.start();
      setState("recording");
      tickRef.current = window.setInterval(() => {
        setSecondsRecorded((s) => s + 1);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone error: ${err.message}`
          : "Microphone access denied"
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function submit() {
    if (!audioBlob) {
      setError("Record something first.");
      return;
    }
    setState("submitting");
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", audioBlob, "response.webm");
      const res = await fetch(`/api/lessons/${lessonId}/submit`, {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        xp_awarded?: number;
        transcript?: string;
        evaluation?: SpeakScoreEvaluation;
      };
      if (!res.ok || !body.evaluation) {
        setError(body.error ?? `HTTP ${res.status}`);
        setState("stopped");
        return;
      }
      setEvaluation(body.evaluation);
      setTranscript(body.transcript ?? null);
      setXp(body.xp_awarded ?? 0);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setState("stopped");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PromptPanel prompt={prompt} />

      {!completed && (
        <div className="rounded-lg border border-cream bg-paper p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Your response
            </span>
            <span
              className={
                state === "recording" && secondsRecorded > prompt.expected_seconds
                  ? "font-mono text-[11px] uppercase tracking-[0.18em] text-coral"
                  : "font-mono text-[11px] uppercase tracking-[0.18em] text-mute"
              }
            >
              {formatSeconds(secondsRecorded)} / target ~
              {formatSeconds(prompt.expected_seconds)}
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 py-6">
            {state === "idle" && (
              <button
                type="button"
                onClick={startRecording}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-navy text-paper shadow-md transition hover:bg-navy-deep"
                aria-label="Start recording"
              >
                <span className="text-3xl">🎙️</span>
              </button>
            )}
            {state === "recording" && (
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-coral text-paper shadow-md transition hover:opacity-90"
                aria-label="Stop recording"
              >
                <span className="h-6 w-6 rounded-sm bg-paper" />
              </button>
            )}
            {state === "stopped" && audioUrl && (
              <div className="flex w-full max-w-md flex-col items-center gap-3">
                <audio
                  src={audioUrl}
                  controls
                  className="w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startRecording}
                    className="rounded-md border border-cream px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-mist"
                  >
                    Re-record
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    className="rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
                  >
                    Submit for scoring
                  </button>
                </div>
              </div>
            )}
            {state === "submitting" && (
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
                Transcribing + scoring…
              </p>
            )}
            <p className="text-center text-xs text-mute">
              {state === "idle" && "Tap the mic to start. Aim for natural pace, not perfection."}
              {state === "recording" && "Recording — tap the square to stop."}
              {state === "stopped" && "Listen back, then submit or re-record."}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href="/lessons"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-navy"
            >
              ← Save and exit
            </Link>
          </div>
          {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        </div>
      )}

      {completed && evaluation && (
        <ResultsPanel
          evaluation={evaluation}
          transcript={transcript}
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

function PromptPanel({ prompt }: { prompt: SpeakScorePrompt }) {
  return (
    <div className="rounded-lg border border-cream bg-paper p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Scenario · {prompt.difficulty_band} ·{" "}
          {prompt.expects_structure ? "Structured answer" : "Quick response"}
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
          ~{prompt.expected_seconds}s
        </span>
      </div>
      <p className="mb-4 leading-relaxed text-ink">{prompt.scenario}</p>
      <div className="space-y-2 border-l-2 border-gold/40 pl-4 text-sm text-ink">
        <p>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
            Speak this
          </span>
          <br />
          {prompt.task}
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({
  evaluation,
  transcript,
  xp,
}: {
  evaluation: SpeakScoreEvaluation;
  transcript: string | null;
  xp: number;
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

      <div
        className={`grid grid-cols-1 gap-4 ${
          evaluation.presentation_delivery ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        <ScoreTile
          label="Speaking fluency"
          score={evaluation.speaking_fluency.score}
          band={evaluation.speaking_fluency.cefr_band}
        />
        <ScoreTile
          label="Business vocabulary"
          score={evaluation.business_vocabulary.score}
          band={evaluation.business_vocabulary.cefr_band}
        />
        {evaluation.presentation_delivery && (
          <ScoreTile
            label="Presentation"
            score={evaluation.presentation_delivery.score}
            band={evaluation.presentation_delivery.cefr_band}
          />
        )}
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
        {transcript && (
          <div className="rounded-lg border border-cream bg-paper p-6">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
              What you said
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {transcript}
            </p>
          </div>
        )}
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Model response (C1 target)
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {evaluation.model_script}
          </p>
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
        <span className="ml-1 font-mono text-xs text-mute">/100</span>
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
