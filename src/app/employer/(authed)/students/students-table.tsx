"use client";

/**
 * Interactive cohort roster: per-row + bulk magic-link invite, on top of
 * the existing roster table. Selection state + send outcomes live here;
 * the row data comes pre-shaped from the server page.
 */

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

export type RosterRow = {
  id: string;
  name: string | null;
  email: string | null;
  target_level: string | null;
  discovery_status: string | null;
  averageScore: number | null;
  totalXp: number;
  streakDays: number;
  lessonsCompleted: number;
  classesCompleted: number;
  lastActivityAt: string | null;
  highestCert: string | null;
  pendingCertLevel: string | null;
};

type RowOutcome = {
  studentId: string;
  ok: boolean;
  emailDelivery?: "sent" | "skipped" | "failed";
  emailError?: string | null;
  actionLink?: string | null;
  error?: string;
};

type SendResponse = {
  ok?: boolean;
  error?: string;
  counts?: { sent: number; failed: number; skipped: number; total: number };
  outcomes?: RowOutcome[];
};

export function StudentsTable({ rows }: { rows: RosterRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Map<string, RowOutcome>>(new Map());
  const [banner, setBanner] = useState<
    | { kind: "info" | "error"; text: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const selectableIds = useMemo(
    () => rows.filter((r) => r.email).map((r) => r.id),
    [rows]
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function send(studentIds: string[]) {
    if (studentIds.length === 0) return;
    setBanner(null);
    startTransition(async () => {
      const res = await fetch("/api/employer/staff/invite-existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds }),
      });
      const data: SendResponse = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.outcomes) {
        setBanner({
          kind: "error",
          text: data.error ?? `Send failed (${res.status})`,
        });
        return;
      }
      setOutcomes((prev) => {
        const next = new Map(prev);
        for (const o of data.outcomes ?? []) next.set(o.studentId, o);
        return next;
      });
      const c = data.counts ?? { sent: 0, failed: 0, skipped: 0, total: 0 };
      setBanner({
        kind: c.failed > 0 ? "error" : "info",
        text:
          c.total === 1
            ? c.sent === 1
              ? "Invite emailed."
              : c.skipped === 1
                ? "Link generated but not emailed (Resend not configured) — see row for the URL."
                : "Send failed — see row for details."
            : `Sent ${c.sent} / ${c.total}${
                c.failed ? `, ${c.failed} failed` : ""
              }${c.skipped ? `, ${c.skipped} skipped` : ""}.`,
      });
      clearSelection();
    });
  }

  const selectedCount = selected.size;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cream bg-mist/30 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            {selectedCount > 0 ? `${selectedCount} selected` : "Select rows to bulk-invite"}
          </span>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute hover:text-navy"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={selectedCount === 0 || isPending}
          onClick={() => send(Array.from(selected))}
          className="rounded-full bg-navy px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:cursor-not-allowed disabled:bg-mute/40"
        >
          {isPending && selectedCount > 0
            ? "Sending…"
            : `Send invite${selectedCount > 1 ? "s" : ""}${
                selectedCount > 0 ? ` (${selectedCount})` : ""
              }`}
        </button>
      </div>

      {banner && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            banner.kind === "error"
              ? "border-coral/30 bg-coral/5 text-coral"
              : "border-teal/30 bg-teal/5 text-teal"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-cream bg-paper">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-mute">
            No students yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-cream bg-mist/50 text-left">
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-cream"
                  />
                </Th>
                <Th>Student</Th>
                <Th>Target</Th>
                <Th>Discovery</Th>
                <Th>Average</Th>
                <Th>Cert</Th>
                <Th>Lessons</Th>
                <Th>Classes</Th>
                <Th>XP</Th>
                <Th>Last active</Th>
                <Th>Invite</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const outcome = outcomes.get(s.id) ?? null;
                const checkboxDisabled = !s.email;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-cream last:border-b-0 hover:bg-mist/40"
                  >
                    <Td>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        disabled={checkboxDisabled}
                        aria-label={`Select ${s.name ?? s.email ?? s.id}`}
                        className="h-4 w-4 rounded border-cream disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </Td>
                    <Td>
                      <Link
                        href={`/employer/students/${s.id}`}
                        className="font-medium text-navy hover:underline"
                      >
                        {s.name?.trim() || s.email || "Unnamed"}
                      </Link>
                      {s.email && s.name && (
                        <p className="font-mono text-[10px] text-mute">
                          {s.email}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <Pill>{s.target_level ?? "—"}</Pill>
                    </Td>
                    <Td>
                      <DiscoveryPill status={s.discovery_status} />
                    </Td>
                    <Td>
                      <span
                        className={
                          s.averageScore === null
                            ? "font-mono text-mute"
                            : s.averageScore >= 800
                              ? "font-mono text-ai-green"
                              : s.averageScore >= 600
                                ? "font-mono text-amber"
                                : "font-mono text-coral"
                        }
                      >
                        {s.averageScore ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <CertCell
                        passed={s.highestCert}
                        pending={s.pendingCertLevel}
                      />
                    </Td>
                    <Td>{s.lessonsCompleted}</Td>
                    <Td>{s.classesCompleted}</Td>
                    <Td>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-sm">{s.totalXp}</span>
                        {s.streakDays > 0 && (
                          <span
                            className="font-mono text-[10px] text-mute"
                            title={`${s.streakDays}-day streak`}
                          >
                            🔥{s.streakDays}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {s.lastActivityAt
                        ? new Date(s.lastActivityAt).toLocaleDateString(
                            "en-AU",
                            { month: "short", day: "numeric" }
                          )
                        : "—"}
                    </Td>
                    <Td>
                      <InviteCell
                        disabled={!s.email || isPending}
                        outcome={outcome}
                        onSend={() => send([s.id])}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function InviteCell({
  disabled,
  outcome,
  onSend,
}: {
  disabled: boolean;
  outcome: RowOutcome | null;
  onSend: () => void;
}) {
  if (outcome && outcome.ok && outcome.emailDelivery === "sent") {
    return (
      <span className="rounded-full border border-teal/30 bg-teal/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
        Sent
      </span>
    );
  }
  if (outcome && outcome.ok && outcome.emailDelivery === "skipped") {
    return (
      <button
        type="button"
        onClick={() => {
          if (outcome.actionLink) {
            navigator.clipboard
              .writeText(outcome.actionLink)
              .catch(() => undefined);
          }
        }}
        className="rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold hover:bg-gold/10"
        title="Email skipped — click to copy the link"
      >
        Copy link
      </button>
    );
  }
  if (outcome && (!outcome.ok || outcome.emailDelivery === "failed")) {
    return (
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        className="rounded-full border border-coral/40 bg-coral/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-coral hover:bg-coral/10 disabled:opacity-50"
        title={outcome.error ?? outcome.emailError ?? "Retry"}
      >
        Retry
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={disabled}
      className="rounded-full border border-navy/30 bg-paper px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy hover:bg-mist/40 disabled:opacity-40"
    >
      Send
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-mute">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-ink">{children}</td>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream bg-mist/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy">
      {children}
    </span>
  );
}

function CertCell({
  passed,
  pending,
}: {
  passed: string | null;
  pending: string | null;
}) {
  if (passed) {
    return (
      <span className="rounded-full border border-teal/30 bg-teal/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
        {passed}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
        {pending} scheduled
      </span>
    );
  }
  return <span className="font-mono text-[10px] text-mute">—</span>;
}

function DiscoveryPill({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete: {
      label: "Complete",
      cls: "border-teal/30 bg-teal/5 text-teal",
    },
    in_progress: {
      label: "In progress",
      cls: "border-amber/30 bg-amber/5 text-amber",
    },
    pending: {
      label: "Pending",
      cls: "border-mute/30 bg-mist/40 text-mute",
    },
  };
  const info = map[status ?? "pending"] ?? map.pending;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${info.cls}`}
    >
      {info.label}
    </span>
  );
}
