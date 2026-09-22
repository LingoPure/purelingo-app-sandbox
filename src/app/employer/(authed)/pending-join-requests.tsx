"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PendingJoinRequest } from "@/lib/employer/data";

export function PendingJoinRequests({
  requests,
}: {
  requests: PendingJoinRequest[];
}) {
  if (requests.length === 0) return null;

  return (
    <section className="rounded-lg border border-gold/40 bg-gold/5 p-6">
      <div className="mb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Needs your review
        </p>
        <h2 className="font-serif text-xl text-navy">
          Pending join requests
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-mute">
          These students self-set-up with a company name that matches an
          organisation you already run. Approve to assign them a role and
          give them access, or decline if they don&rsquo;t belong here.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-cream">
        {requests.map((r) => (
          <JoinRequestRow key={r.membershipId} request={r} />
        ))}
      </ul>
    </section>
  );
}

function JoinRequestRow({ request }: { request: PendingJoinRequest }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function approve() {
    if (!roleId) {
      setError("Pick a role first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/employer/join-requests/${request.membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Approve failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/employer/join-requests/${request.membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Decline failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">
          {request.studentName?.trim() || request.studentEmail || "Unnamed student"}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
          wants to join {request.organisationName} ·{" "}
          {new Date(request.requestedAt).toLocaleDateString("en-AU", {
            month: "short",
            day: "numeric",
          })}
        </p>
        {error && <p className="mt-1 text-xs text-coral">{error}</p>}
      </div>
      <div className="flex min-h-[44px] items-center gap-2">
        {request.availableRoles.length > 0 ? (
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={isPending}
            className="min-h-[44px] rounded-md border border-cream bg-mist/30 px-2 text-sm text-ink focus:border-navy focus:outline-none"
          >
            <option value="">Assign role...</option>
            {request.availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-mute">
            No roles set up for this org yet
          </span>
        )}
        <button
          type="button"
          onClick={approve}
          disabled={isPending || request.availableRoles.length === 0}
          className="min-h-[44px] rounded-md bg-navy px-4 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={isPending}
          className="min-h-[44px] rounded-md border border-cream px-4 text-sm text-mute hover:border-coral/40 hover:text-coral disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </li>
  );
}
