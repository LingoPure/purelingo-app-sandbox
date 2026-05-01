"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  redirectTo: string;
  fieldLabel: string;
  submitLabel: string;
  submittingLabel: string;
};

export function LoginForm({
  redirectTo,
  fieldLabel,
  submitLabel,
  submittingLabel,
}: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/employer/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        setPending(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label
        htmlFor="employer-access-password"
        className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute"
      >
        {fieldLabel}
      </label>
      <input
        id="employer-access-password"
        name="access_password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
        className="rounded-md border border-paper/15 bg-paper/5 px-3 py-2 text-sm text-paper placeholder:text-mute focus:border-paper/40 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-paper px-5 py-2 text-sm font-medium text-navy hover:bg-cream disabled:opacity-50"
      >
        {pending ? submittingLabel : submitLabel}
      </button>
      {error && (
        <p className="text-sm text-coral">{error}</p>
      )}
    </form>
  );
}
