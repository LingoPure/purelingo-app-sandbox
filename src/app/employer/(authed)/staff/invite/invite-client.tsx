"use client";

import { useMemo, useState, useTransition } from "react";

type Role = { id: string; name: string };
type StaffPick = {
  id: string;
  name: string | null;
  email: string;
  role_id: string | null;
  target_level: string | null;
};
type Outcome =
  | {
      ok: true;
      message: string;
      kind: "invite" | "magiclink";
      actionLink: string | null;
      mailWarning: string | null;
      emailDelivery: "sent" | "skipped" | "failed";
      email: string;
    }
  | { ok: false; error: string };

const TARGETS = ["A2", "B1", "B2", "C1", "C2"] as const;
type TargetLevel = (typeof TARGETS)[number];

function isTargetLevel(value: string | null | undefined): value is TargetLevel {
  return TARGETS.some((t) => t === value);
}

export function InviteClient({
  roles,
  existingStaff,
}: {
  roles: Role[];
  existingStaff: StaffPick[];
}) {
  // "" = "Add new" (free-form). Anything else = id of an existing
  // student → name/email lock to their record, role/target prefill but
  // remain editable so admin can reassign before sending.
  const [pickedStaffId, setPickedStaffId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [targetLevel, setTargetLevel] = useState<TargetLevel>("B2");
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [copied, setCopied] = useState(false);

  const staffById = useMemo(
    () => new Map(existingStaff.map((s) => [s.id, s] as const)),
    [existingStaff]
  );
  const validRoleIds = useMemo(
    () => new Set(roles.map((r) => r.id)),
    [roles]
  );
  const isExistingPicked = pickedStaffId !== "";

  function reset() {
    setPickedStaffId("");
    setName("");
    setEmail("");
    setRoleId(roles[0]?.id ?? "");
    setTargetLevel("B2");
  }

  function onPickStaff(id: string) {
    setPickedStaffId(id);
    setOutcome(null);
    setCopied(false);
    if (id === "") {
      setName("");
      setEmail("");
      setRoleId(roles[0]?.id ?? "");
      setTargetLevel("B2");
      return;
    }
    const pick = staffById.get(id);
    if (!pick) return;
    setName(pick.name?.trim() ?? "");
    setEmail(pick.email);
    setRoleId(
      pick.role_id && validRoleIds.has(pick.role_id)
        ? pick.role_id
        : roles[0]?.id ?? ""
    );
    setTargetLevel(isTargetLevel(pick.target_level) ? pick.target_level : "B2");
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOutcome(null);
    setCopied(false);
    if (!name.trim() || !email.trim() || !roleId) {
      setOutcome({ ok: false, error: "Fill in name, email, and role." });
      return;
    }
    const submittedEmail = email.trim();
    startTransition(async () => {
      const res = await fetch("/api/employer/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: submittedEmail,
          roleId,
          targetLevel,
        }),
      });
      const data: {
        ok?: boolean;
        message?: string;
        error?: string;
        kind?: "invite" | "magiclink";
        actionLink?: string | null;
        mailWarning?: string | null;
        emailDelivery?: "sent" | "skipped" | "failed";
      } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setOutcome({
          ok: false,
          error: data.error ?? `Invite failed (${res.status})`,
        });
        return;
      }
      setOutcome({
        ok: true,
        message: data.message ?? "Invite created.",
        kind: data.kind ?? "invite",
        actionLink: data.actionLink ?? null,
        mailWarning: data.mailWarning ?? null,
        emailDelivery: data.emailDelivery ?? "skipped",
        email: submittedEmail,
      });
      reset();
    });
  }

  async function copyLink() {
    if (!outcome || !outcome.ok || !outcome.actionLink) return;
    try {
      await navigator.clipboard.writeText(outcome.actionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore — user can still select + copy manually
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-4 grid grid-cols-1 gap-4">
          <Field
            label="Pick an existing employee"
            hint={
              existingStaff.length === 0
                ? "Roster is empty — fill in the fields below to add someone new."
                : "Select someone from your roster, or leave on “Add new…” to enter details manually."
            }
          >
            <select
              value={pickedStaffId}
              onChange={(e) => onPickStaff(e.target.value)}
              disabled={existingStaff.length === 0}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none disabled:opacity-60"
            >
              <option value="">+ Add new…</option>
              {existingStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.name?.trim() || s.email) +
                    (s.name?.trim() ? ` — ${s.email}` : "")}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Full name"
            hint={
              isExistingPicked
                ? "Locked — change on the student's profile."
                : undefined
            }
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Thị Hoa"
              maxLength={120}
              required
              readOnly={isExistingPicked}
              className={`w-full rounded-md border border-cream px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none ${
                isExistingPicked
                  ? "bg-mist/60 text-mute"
                  : "bg-mist/30"
              }`}
            />
          </Field>
          <Field
            label="Work email"
            hint={
              isExistingPicked
                ? "Locked — invite sends to this address."
                : undefined
            }
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hoa.nguyen@abc-manufacturer.demo"
              maxLength={254}
              required
              readOnly={isExistingPicked}
              className={`w-full rounded-md border border-cream px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none ${
                isExistingPicked
                  ? "bg-mist/60 text-mute"
                  : "bg-mist/30"
              }`}
            />
          </Field>
          <Field
            label="Role"
            hint={
              isExistingPicked
                ? "Change to reassign this employee to a different role baseline."
                : undefined
            }
          >
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
              required
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Personal target"
            hint="Their aspirational level — drives the gap-closing roadmap."
          >
            <select
              value={targetLevel}
              onChange={(e) =>
                setTargetLevel(e.target.value as TargetLevel)
              }
              className="w-full rounded-md border border-cream bg-mist/30 px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none"
            >
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {outcome && !outcome.ok && (
        <div className="rounded-md border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-coral">
          {outcome.error}
        </div>
      )}

      {outcome && outcome.ok && (
        <div className="flex flex-col gap-3 rounded-lg border border-teal/30 bg-teal/5 p-5 text-sm text-ink">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
            {outcome.emailDelivery === "sent"
              ? "Email sent via Resend"
              : outcome.emailDelivery === "failed"
                ? "Email send failed"
                : outcome.kind === "invite"
                  ? "Invite created"
                  : "Magic link created"}
          </p>
          <p>
            <span className="text-teal">✓</span> {outcome.message}
          </p>
          {outcome.mailWarning && (
            <p className="rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold">
              {outcome.mailWarning}
            </p>
          )}
          {outcome.actionLink && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
                Sign-in link (paste into a chat or email if Supabase didn&apos;t deliver)
              </p>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={outcome.actionLink}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-cream bg-paper px-3 py-2 font-mono text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-md border border-cream bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-mist/40"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-mute">
                The link signs {outcome.email} in once and lands them on
                /onboarding. It expires after a single use or roughly an
                hour, whichever comes first.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-navy px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90 disabled:opacity-50"
        >
          {isPending
            ? "Sending…"
            : isExistingPicked
              ? "Send invite to selected"
              : "Add and send invite"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </div>
  );
}
