"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button with a built-in pending state for server-action forms — so a
 * slow login/signup shows "Signing in…" + a spinner instead of looking dead
 * (the silent-slow-login abandonment risk). Uses useFormStatus, so it reflects
 * the enclosing <form>'s submission without any wiring.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <svg
            className="animate-spin"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
