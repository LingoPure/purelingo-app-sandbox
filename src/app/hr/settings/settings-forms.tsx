"use client";

import { useActionState, useState } from "react";
import {
  updateOwnLocaleAction,
  updateOwnPasswordAction,
  type ActionResult,
} from "../actions";
import { Field, Panel, PanelHeader, inputClass, buttonPrimaryClass } from "../ui";
import { HR_LOCALES } from "@/lib/hr/i18n/dictionary";
import type { HrLocale } from "@/lib/hr/types";

/**
 * Strings arrive pre-translated. A client component cannot resolve a locale —
 * that means a database read — so the server page does it and hands the result
 * over as plain data.
 */
export type LanguageLabels = {
  title: string;
  intro: string;
  field: string;
  companyDefault: string;
  save: string;
  saving: string;
};

export type PasswordLabels = {
  title: string;
  intro: string;
  newPassword: string;
  confirmPassword: string;
  submit: string;
  working: string;
  show: string;
  hide: string;
};

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-md bg-ai-green/10 px-4 py-3 text-sm text-ai-green">
      {state.message ?? ""}
    </p>
  ) : (
    <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
      {state.error}
    </p>
  );
}

export function LanguageForm({
  current,
  labels,
}: {
  current: HrLocale | null;
  labels: LanguageLabels;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => updateOwnLocaleAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.title}>{labels.intro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <Field id="locale" label={labels.field}>
          <select id="locale" name="locale" defaultValue={current ?? ""} className={inputClass}>
            <option value="">{labels.companyDefault}</option>
            {/* Language names are always shown in their OWN language. Someone
                looking for Vietnamese scans for "Tiếng Việt", not for whatever
                the current interface calls it. */}
            {HR_LOCALES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Password change.
 *
 * Both fields carry a visibility toggle, per the auth-page pattern. The toggle
 * is `tabIndex={-1}` so keyboard users tabbing through the form go straight
 * from one password field to the next rather than through a decoration.
 */
export function PasswordForm({ labels }: { labels: PasswordLabels }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => updateOwnPasswordAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.title}>{labels.intro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <PasswordField
          id="password"
          name="password"
          label={labels.newPassword}
          autoComplete="new-password"
          show={labels.show}
          hide={labels.hide}
        />
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label={labels.confirmPassword}
          autoComplete="new-password"
          show={labels.show}
          hide={labels.hide}
        />

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? labels.working : labels.submit}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  show,
  hide,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  show: string;
  hide: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} required>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={10}
          autoComplete={autoComplete}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hide : show}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-mute hover:text-navy"
        >
          {visible ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 3l14 14M8.5 8.6a2 2 0 002.8 2.8M6.5 6.6C4.7 7.7 3.4 9.3 2.7 10c1.4 1.6 4 4 7.3 4 1.3 0 2.4-.3 3.4-.9M11.5 6.2c2.9.5 5 2.9 5.8 3.8-.3.4-.9 1-1.7 1.7"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M2.7 10S5.3 6 10 6s7.3 4 7.3 4-2.6 4-7.3 4-7.3-4-7.3-4z"
                stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          )}
        </button>
      </div>
    </Field>
  );
}
