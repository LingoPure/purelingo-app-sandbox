"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuestionDefinition } from "@/lib/2k/question-bank";
import type { CanonicalAssessmentResult } from "@/lib/2k/contracts";

type CanonicalResult = CanonicalAssessmentResult;

type Phase = "intro" | "recording" | "processing" | "result";

type StoredResponse = {
  response_id: string;
  question_id: string;
  stage: string;
  task: string;
  client_transcript?: string;
  timing: { started_at: string; ended_at: string; duration_ms: number };
  audioBlob?: Blob;
};

const STAGE_LABELS: Record<string, string> = {
  LOCATE: "Getting to know your communication",
  BOUND: "Structured professional scenarios",
  RESOLVE: "Precision and compression",
  PERTURB: "Adaptation under pressure",
  CONFIRM: "Executive judgment",
};

const STAGE_ORDER = ["LOCATE", "BOUND", "RESOLVE", "PERTURB", "CONFIRM"];

type Props = {
  questions: readonly QuestionDefinition[];
  resumable?: { assessment_id: string; answered: string[]; total: number } | null;
};

export function AssessmentRunner({ questions, resumable }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [activeIdx, setActiveIdx] = useState(0);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState>("prompt");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [result, setResult] = useState<CanonicalResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = questions[activeIdx];
  const currentStage = active?.stage;
  const stageIdx = STAGE_ORDER.indexOf(currentStage);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    stopTimer();
    setIsRecording(false);
  }, [stream, stopTimer]);

  useEffect(() => {
    return () => cleanupStream();
  }, [cleanupStream]);

  const requestMic = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      setMicPermission("granted");
    } catch {
      setMicPermission("denied");
    }
  }, []);

  const beginAssessment = useCallback(async () => {
    setSyncError(null);
    const res = await fetch("/api/2k/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: crypto.randomUUID(),
        language: "vi-VN",
        question_bank_version: "2k-v1",
        context: {},
        consent: {
          audio_recording: true,
          data_processing: true,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error((body as { error?: string } | null)?.error ?? "Could not start assessment");
    }
    const body = (await res.json()) as { assessment: { assessment_id: string } };
    setAssessmentId(body.assessment.assessment_id);
  }, []);

  const resumeAssessment = useCallback(async () => {
    if (!resumable) return;
    setSyncError(null);
    setAssessmentId(resumable.assessment_id);
    // Jump to the first unanswered question (answered ids are contiguous).
    const firstUnanswered = questions.findIndex(
      (q) => !resumable.answered.includes(q.question_id)
    );
    setActiveIdx(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
    setElapsed(0);
    setPhase("recording");
  }, [resumable, questions]);

  const persistResponse = useCallback(
    async (response: StoredResponse) => {
      if (!assessmentId) return;
      const res = await fetch(`/api/2k/assessments/${assessmentId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: {
            response_id: response.response_id,
            question_id: response.question_id,
            stage: response.stage,
            task: response.task,
            client_transcript: response.client_transcript,
            timing: response.timing,
            device: {
              browser: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
              os: "web",
              is_mobile: typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent),
            },
            assistance_status: "none",
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? "Could not save response");
      }
    },
    [assessmentId]
  );

  const uploadAudio = useCallback(async (response: StoredResponse) => {
    if (!response.audioBlob) return;
    const form = new FormData();
    form.append("file", response.audioBlob, `${response.response_id}.webm`);
    form.append("duration_ms", String(response.timing.duration_ms || 0));
    const res = await fetch(`/api/2k/responses/${response.response_id}/audio`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error((body as { error?: string } | null)?.error ?? "Could not upload audio");
    }
  }, []);

  const evaluateAssessment = useCallback(async () => {
    if (!assessmentId) return;
    const res = await fetch(`/api/2k/assessments/${assessmentId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "complete" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error((body as { error?: string } | null)?.error ?? "Could not start evaluation");
    }
  }, [assessmentId]);

  const fetchResult = useCallback(async () => {
    if (!assessmentId) return null;
    const res = await fetch(`/api/2k/assessments/${assessmentId}/result`);
    if (!res.ok) throw new Error("Could not load result");
    const body = (await res.json()) as { result: CanonicalResult };
    setResult(body.result);
    return body.result;
  }, [assessmentId]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    // ISS-015: pick the best supported MIME type; fall back to the browser default.
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    const preferred =
      typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function"
        ? candidates.find((c) => MediaRecorder.isTypeSupported(c))
        : undefined;
    const options = preferred ? { mimeType: preferred } : undefined;
    const recorder = new MediaRecorder(stream, options);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    startedAtRef.current = new Date().toISOString();
    recorder.start();
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [stream]);

  const stopRecording = useCallback(() => {
    return new Promise<void>((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
      stopTimer();
      setIsRecording(false);
    });
  }, [stopTimer]);

  const submitResponse = useCallback(async () => {
    if (!active) return;
    const endedAt = new Date().toISOString();
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const response: StoredResponse = {
      response_id: crypto.randomUUID(),
      question_id: active.question_id,
      stage: active.stage,
      task: active.prompt,
      timing: {
        started_at: startedAtRef.current,
        ended_at: endedAt,
        duration_ms: elapsed * 1000,
      },
      audioBlob: blob,
    };
    try {
      await persistResponse(response);
      setSyncError(null);
      // ISS-016: durable audio upload (best-effort — the metadata row is already
      // persisted, so a failed upload degrades to upload_status=pending, not a
      // lost answer.)
      try {
        await uploadAudio(response);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Audio upload pending");
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Could not save response");
    }
  }, [active, elapsed, persistResponse, uploadAudio]);

  const handleNext = useCallback(async () => {
    setIsSyncing(true);
    await submitResponse();
    if (activeIdx < questions.length - 1) {
      setActiveIdx((i) => i + 1);
      setElapsed(0);
    } else {
      cleanupStream();
      setPhase("processing");
      try {
        await evaluateAssessment();
        await fetchResult();
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Could not finish assessment");
      }
      setTimeout(() => setPhase("result"), 400);
    }
    setIsSyncing(false);
  }, [submitResponse, evaluateAssessment, fetchResult, activeIdx, questions.length, cleanupStream]);

  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        {resumable && (
          <div className="rounded-lg border border-gold/40 bg-gold/5 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Resume your assessment
            </p>
            <h2 className="mt-2 font-serif text-xl text-navy">
              {resumable.answered.length} of {resumable.total} questions answered
            </h2>
            <p className="mt-2 text-sm text-mute">
              Pick up where you left off. Your saved responses stay intact.
            </p>
            <button
              type="button"
              onClick={resumeAssessment}
              className="mt-4 rounded-md bg-navy px-6 py-3 text-sm font-medium text-paper hover:bg-navy-deep"
            >
              Resume assessment
            </button>
          </div>
        )}
        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            How it works
          </p>
          <h2 className="mt-2 font-serif text-2xl text-navy">
            25 speaking questions across 5 stages
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-mute">
            Each question is a real professional communication scenario.
            You&apos;ll have about one minute per question. Record your answer
            using your microphone, then move to the next.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
            {STAGE_ORDER.map((s) => (
              <div
                key={s}
                className="rounded-md border border-cream bg-mist/50 px-3 py-2 text-center"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-gold">
                  {s}
                </p>
                <p className="mt-0.5 text-xs text-mute">
                  Q{STAGE_ORDER.indexOf(s) * 5 + 1}–{STAGE_ORDER.indexOf(s) * 5 + 5}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Before you begin
          </p>
          <h3 className="mt-2 font-serif text-lg text-navy">
            Microphone access required
          </h3>
          <p className="mt-2 text-sm text-mute">
            {micPermission === "granted"
              ? "Microphone is ready."
              : micPermission === "denied"
                ? "Microphone access was denied. Please enable it in your browser settings and refresh."
                : "You'll be asked to allow microphone access when you start."}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={micPermission === "denied" || isSyncing}
            onClick={async () => {
              setIsSyncing(true);
              setSyncError(null);
              if (micPermission !== "granted") {
                try {
                  await requestMic();
                } catch {
                  setMicPermission("denied");
                }
              }
              try {
                await beginAssessment();
                setPhase("recording");
              } catch (err) {
                setSyncError(err instanceof Error ? err.message : "Could not start assessment");
              } finally {
                setIsSyncing(false);
              }
            }}
            className="rounded-md bg-navy px-6 py-3 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-40"
          >
            {isSyncing ? "Starting..." : "Start assessment"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-md border border-navy/20 px-6 py-3 text-sm font-medium text-navy hover:bg-mist"
          >
            Back to dashboard
          </button>
        </div>
        {syncError && (
          <p className="text-sm text-coral">{syncError}</p>
        )}
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="mx-auto max-w-2xl flex flex-col items-center gap-6 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy border-t-transparent" />
        <p className="font-mono text-sm uppercase tracking-widest text-mute">
          Processing your responses...
        </p>
        <p className="text-sm text-mute">
          Running communication analysis, evidence governance and scoring.
        </p>
      </div>
    );
  }

  if (phase === "result") {
    if (!result) {
      return (
        <div className="mx-auto max-w-2xl flex flex-col gap-6">
          <div className="rounded-lg border border-coral/30 bg-coral/5 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-coral">
              Result unavailable
            </p>
            <p className="mt-2 text-sm text-mute">{syncError ?? "No result payload was returned."}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="self-start rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            Back to dashboard
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="rounded-lg border border-teal/30 bg-teal/5 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
            Assessment complete
          </p>
          <h2 className="mt-1 font-serif text-2xl text-navy">
            {result.coverage.answered} of {result.coverage.total_questions} responses recorded
          </h2>
          <p className="mt-2 text-sm text-mute">
            Coverage {result.coverage.coverage_pct}% · frozen result {result.result_id.slice(0, 8)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-cream bg-paper p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              LP-1000 composite
            </p>
            <p className="mt-2 font-serif text-5xl text-navy">{result.lp1000.score}</p>
            <p className="mt-1 font-mono text-sm text-mute">
              band {result.lp1000.band} · conf {result.lp1000.confidence.toFixed(2)}
            </p>
          </div>

          <div className="rounded-lg border border-cream bg-paper p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Recommendation
            </p>
            <p className="mt-2 text-sm text-ink">
              Family {result.recommendation.family} · priority {result.recommendation.priority} · {result.recommendation.exposure}
            </p>
            {result.recommendation.next_probe && (
              <p className="mt-2 text-sm text-mute">{result.recommendation.next_probe}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Capability dimensions
          </p>
          <div className="space-y-3">
            {result.telemetry.dimensions.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <p className="w-40 shrink-0 text-sm text-ink capitalize">{d.name}</p>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full bg-navy"
                    style={{ width: `${d.score / 10}%` }}
                  />
                </div>
                <p className="w-12 text-right font-mono text-sm tabular-nums text-mute">
                  {d.score}
                </p>
                <p className="w-16 text-right font-mono text-xs text-mute">
                  conf {d.confidence.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="self-start rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  // ─── Recording phase ───────────────────────────────────────────────────────
  const isLastQuestion = activeIdx === questions.length - 1;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {syncError && (
        <div className="rounded-lg border border-coral/30 bg-coral/5 p-4">
          <p className="text-sm text-coral">{syncError}</p>
        </div>
      )}
      {/* Progress header */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-mute">
            Question {activeIdx + 1} of {questions.length}
          </p>
          <div className="flex gap-1">
            {STAGE_ORDER.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full ${
                  i < stageIdx
                    ? "bg-gold"
                    : i === stageIdx
                      ? "bg-navy"
                      : "bg-cream"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-navy/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-navy">
            {active?.stage}
          </span>
          <span className="text-xs text-mute">{STAGE_LABELS[currentStage]}</span>
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          {active?.question_id}
        </p>
        <p className="text-lg leading-relaxed text-ink">{active?.prompt}</p>
      </div>

      {/* Timer + mic */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={isRecording ? () => stopRecording().then(handleNext) : startRecording}
          disabled={!stream && !isRecording}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-colors ${
            isRecording
              ? "border-coral bg-coral/10 text-coral animate-pulse"
              : "border-navy bg-navy/10 text-navy hover:bg-navy/20"
          }`}
        >
          {isRecording ? (
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>

        <div className="flex-1">
          <p className="font-mono text-2xl tabular-nums text-navy">
            {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
            {String(elapsed % 60).padStart(2, "0")}
          </p>
          <p className="text-xs text-mute">
            {isRecording
              ? "Recording — click stop when done, or wait for auto-submit"
              : "Click to start recording your answer"}
          </p>
        </div>
      </div>

      {/* Skip / next controls (visible after recording or to skip) */}
      <div className="flex justify-end gap-3">
        {!isRecording && elapsed > 0 && (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            {isLastQuestion ? "Submit assessment" : "Next question"}
          </button>
        )}
      </div>

      {/* Auto-submit at 60s */}
      {isRecording && elapsed >= 60 && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
          <p className="text-sm text-mute">
            Time is up — your response has been captured. Click stop or it will
            auto-submit.
          </p>
        </div>
      )}
    </div>
  );
}
