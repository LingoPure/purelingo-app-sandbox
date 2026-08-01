/**
 * Shared presentation pieces for the HR surfaces.
 *
 * Server components with no state, so they can be used from any HR page. The
 * one thing they enforce is the explanatory header: every surface says what it
 * is, what to do here and why it matters, before showing a form or a table.
 */

import type { ReactNode } from "react";

/**
 * The header every HR page opens with.
 *
 * Operator-facing and matter-of-fact: no greeting, no exclamation, no "Welcome
 * to". Someone landing here cold should be able to tell within one sentence
 * whether they are in the right place.
 */
export function PageHeader({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-cream pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-prose">
          <h1 className="font-serif text-2xl text-navy sm:text-3xl">{title}</h1>
          <p className="mt-2 text-base leading-relaxed text-ink/70">{children}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/** Denser header for a panel embedded inside a page. */
export function PanelHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-lg text-navy">{title}</h2>
      {children ? (
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">{children}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-cream bg-paper p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

/**
 * A labelled form field.
 *
 * Label is a real <label> bound by id, full width on mobile, and hint text sits
 * under the control rather than as a placeholder — placeholder-as-label
 * disappears the moment someone starts typing, which is exactly when they most
 * want to check what the field was.
 */
export function Field({
  id,
  label,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}
        {required ? <span className="ml-1 text-coral" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-mute">{hint}</p> : null}
    </div>
  );
}

/** Shared input styling. 16px base prevents iOS zoom-on-focus; 44px min height. */
export const inputClass =
  "min-h-[44px] w-full rounded-md border border-line bg-paper px-3 py-2 text-base " +
  "text-ink outline-none transition focus:border-navy-soft focus:ring-2 focus:ring-navy-soft/20";

export const buttonPrimaryClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-navy px-5 py-2.5 " +
  "text-sm font-semibold text-paper transition hover:bg-navy-deep sm:w-auto";

export const buttonQuietClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-md border border-line " +
  "bg-paper px-5 py-2.5 text-sm font-semibold text-navy transition hover:bg-mist sm:w-auto";

export const buttonDangerClass =
  "inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-coral px-5 py-2.5 " +
  "text-sm font-semibold text-paper transition hover:opacity-90 sm:w-auto";

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-ai-green/10 text-ai-green",
    invited: "bg-gold/15 text-gold",
    deactivated: "bg-mute/15 text-mute",
  };
  const label: Record<string, string> = {
    active: "Active",
    invited: "Invited",
    deactivated: "Deactivated",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        tone[status] ?? "bg-mute/15 text-mute"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

export function RequestStatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: "bg-gold/15 text-gold",
    approved: "bg-ai-green/10 text-ai-green",
    declined: "bg-coral/10 text-coral",
    cancelled: "bg-mute/15 text-mute",
  };
  const label: Record<string, string> = {
    pending: "Awaiting decision",
    approved: "Approved",
    declined: "Declined",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        tone[status] ?? "bg-mute/15 text-mute"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

/** A date range, collapsed to one date when both ends match. */
export function DateRange({ from, to }: { from: string; to: string }) {
  return <span>{from === to ? from : `${from} → ${to}`}</span>;
}

export function RolePill({ role }: { role: string }) {
  const label: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Manager",
    staff: "Staff",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-navy">
      {label[role] ?? role}
    </span>
  );
}

/**
 * Empty state that still points somewhere.
 *
 * A table with nothing in it and no next action is a dead end; every empty
 * state here names the thing to do next.
 */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-mist/50 px-5 py-10 text-center">
      <p className="font-medium text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm leading-relaxed text-mute">{children}</p>
    </div>
  );
}
