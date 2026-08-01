"use client";

import { useActionState, useState } from "react";
import {
  updateOwnLocaleAction,
  updateOwnPasswordAction,
  type ActionResult,
} from "../actions";
import {
  Field,
  Panel,
  PanelHeader,
  inputClass,
  buttonPrimaryClass,
} from "../ui";
import type { HrLocale } from "@/lib/hr/types";

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-md bg-ai-green/10 px-4 py-3 text-sm text-ai-green">
      {state.message ?? "Saved."}
    </p>
  ) : (
    <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
      {state.error}
    </p>
  );
}

export function LanguageForm({ current }: { current: HrLocale | null }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => updateOwnLocaleAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title="Language">
        Sets the language of this interface and of the emails we send you about
        your leave.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <Field id="locale" label="Display language">
          <select id="locale" name="locale" defaultValue={current ?? ""} className={inputClass}>
            <option value="">Company default</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Saving…" : "Save language"}
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
export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => updateOwnPasswordAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title="Password">
        Changing your password signs you out of nothing else — your other
        sessions stay open. Use at least 10 characters.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <PasswordField id="password" name="password" label="New password" autoComplete="new-password" />
        <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm new password" autoComplete="new-password" />

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Updating…" : "Update password"}
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
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
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
          aria-label={visible ? "Hide password" : "Show password"}
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
