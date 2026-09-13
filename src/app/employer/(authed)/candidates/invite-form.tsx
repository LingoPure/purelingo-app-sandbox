"use client";

import { useState, useTransition } from "react";
import type { RoleIndexRow } from "@/lib/employer/roles-data";
import { inviteCandidate, type InviteResult } from "./actions";

export function InviteCandidateForm({ roles }: { roles: RoleIndexRow[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [message, setMessage] = useState<InviteResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    const fd = { name, email, roleId: roleId || undefined };
    startTransition(async () => {
      setMessage(await inviteCandidate(fd));
      if (email && !message?.ok) {
        // read result from state update below
      }
    });
  }

  const showMessage = message ? (
    message.ok ? (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        Screen invite sent to {message.email}. They&apos;ll receive a personal link.
      </p>
    ) : (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {message.error}
      </p>
    )
  ) : null;

  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <h3 className="font-serif text-lg text-navy">Invite a candidate</h3>
      <p className="mt-1 text-xs text-mute">
        The candidate takes the 30-minute screen with a zero-form account — you get a
        role-fit view against the target role when they finish.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
            Candidate name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anh Thu"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
            Email *
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@example.com"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mute">
            Target role
          </span>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy"
          >
            <option value="">— not specified —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            onClick={submit}
            disabled={pending || !email}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {pending ? "Sending…" : "Invite"}
          </button>
        </div>
      </div>
      {showMessage && <div className="mt-3">{showMessage}</div>}
    </div>
  );
}