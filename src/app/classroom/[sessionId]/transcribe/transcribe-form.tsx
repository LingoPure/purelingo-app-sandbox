"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SAMPLE = `TEACHER: Good morning Lan, ready for today? We're going to do a 10-minute focus on email follow-ups.
STUDENT: Yes good morning. I am ready.
TEACHER: Tell me — when a client doesn't reply for a week, what do you usually write?
STUDENT: Usually I write "Hi, just checking in. Have you got time to look at this?" Something like that.
TEACHER: OK, that's polite but a bit soft. Can you try a version where you give them a reason to reply now?
STUDENT: Hmm. Maybe... "Hi, I wanted to see if you have any update. We are starting next week so it is good if we know your decision before then."
TEACHER: Better — but watch the structure. You buried the deadline. Try leading with it.
STUDENT: OK. "Hi, we kick off next week — could you confirm your decision by Friday so we can include you?"
TEACHER: That's much stronger. Notice you used "kick off" — where did you learn that?
STUDENT: From my colleagues, in our Monday calls.
TEACHER: Good. Now the second part of the lesson — listening. I'm going to play a 30-second clip of a fast British speaker. Tell me afterwards what they were complaining about.`;

export function TranscribeForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (!transcript.trim()) {
      setError("Paste a transcript first.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/classin/sync/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_text: transcript }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        participation_summary?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setSummary(body.participation_summary ?? "Scored.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
        Transcript
      </label>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={14}
        placeholder="TEACHER: ...&#10;STUDENT: ...&#10;TEACHER: ..."
        className="w-full rounded-md border border-paper/15 bg-paper/5 p-3 font-mono text-xs text-paper placeholder:text-mute focus:border-paper/40 focus:outline-none"
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setTranscript(SAMPLE)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute hover:text-paper"
        >
          Load sample
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-paper px-5 py-2 text-sm font-medium text-navy hover:bg-cream disabled:opacity-50"
        >
          {pending ? "Scoring…" : "Score this session"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </div>
      )}
      {summary && (
        <div className="rounded-md border border-teal-soft/30 bg-teal-soft/10 p-4">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-teal-soft">
            Coach note
          </p>
          <p className="text-sm leading-relaxed text-paper">{summary}</p>
          <p className="mt-3 text-xs text-mute">
            Updated scores are visible on the{" "}
            <a href="/dashboard" className="underline hover:text-paper">
              dashboard
            </a>
            .
          </p>
        </div>
      )}
    </form>
  );
}
