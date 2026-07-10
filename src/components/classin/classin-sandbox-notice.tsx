"use client";

import { useEffect } from "react";

/**
 * Popup shown when a user triggers a ClassIn-dependent action while ClassIn
 * is not connected (the sandbox / demo build). ClassIn is wired up in the
 * production build; here we flag it plainly instead of pretending the live
 * classroom works. Optionally offers to continue in demo mode (e.g. schedule
 * a placeholder session so the rest of the flow can be walked).
 */
export function ClassInSandboxNotice({
  open,
  onClose,
  onContinue,
  continueLabel = "Continue in demo mode",
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="classin-sandbox-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl border border-cream bg-paper p-6 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-navy">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Sandbox
        </span>
        <h2
          id="classin-sandbox-title"
          className="mt-3 font-serif text-xl text-navy"
        >
          ClassIn isn&apos;t connected in the sandbox
        </h2>
        <p className="mt-2 text-base leading-relaxed text-mute">
          Live classes run on ClassIn, which isn&apos;t connected in this
          sandbox demo yet — it&apos;s wired up in the production build.
          {onContinue
            ? " You can continue in demo mode: this schedules a placeholder session so you can walk the rest of the flow end-to-end."
            : " You can still explore the rest of the flow."}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-cream px-4 py-2.5 text-sm font-medium text-navy transition hover:bg-mist"
          >
            {onContinue ? "Not now" : "Got it"}
          </button>
          {onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-navy-deep disabled:opacity-50"
            >
              {busy ? "Scheduling…" : continueLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
