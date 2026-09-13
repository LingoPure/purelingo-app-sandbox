"use client";

import { useState, useTransition } from "react";
import { startCandidateScreen, type StartResult } from "./actions";

export function ScreenStart({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<StartResult | null>(null);

  function start() {
    startTransition(async () => {
      setResult(await startCandidateScreen(token));
    });
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4">
        <p className="text-sm font-semibold text-green-800">Check your inbox</p>
        <p className="mt-1 text-sm text-green-700">
          We&apos;ve sent a secure sign-in link to <strong>{result.email}</strong>. Open it and
          you&apos;ll land straight in the assessment.
        </p>
      </div>
    );
  }

  if (result && !result.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
        <p className="text-sm font-semibold text-red-800">We couldn&apos;t start the screen</p>
        <p className="mt-1 text-sm text-red-700">{result.error}</p>
      </div>
    );
  }

  return (
    <button
      onClick={start}
      disabled={pending}
      className="w-full rounded-lg px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-50 sm:w-auto"
      style={{ background: "#c8973a" }}
    >
      {pending ? "Preparing…" : "Start the assessment"}
    </button>
  );
}