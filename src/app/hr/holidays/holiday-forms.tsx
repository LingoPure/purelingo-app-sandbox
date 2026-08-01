"use client";

import { useActionState, useState } from "react";
import {
  createHolidayAction,
  deleteHolidayAction,
  setOverrideAction,
  removeOverrideAction,
} from "../holiday-actions";
import type { ActionResult } from "../actions";
import {
  Field,
  Panel,
  PanelHeader,
  inputClass,
  buttonPrimaryClass,
  buttonQuietClass,
} from "../ui";

/** Pre-translated strings from the server page. */
export type HolidayLabels = Record<string, string>;

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

/**
 * Add a public holiday.
 *
 * A single date field plus an optional last day, rather than two required
 * dates: most holidays are one day, and making everyone enter the same date
 * twice for the common case to serve Tết is the wrong trade.
 */
export function AddHolidayForm({
  defaultDate,
  labels,
}: {
  defaultDate: string;
  labels: HolidayLabels;
}) {
  const [multiDay, setMultiDay] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => createHolidayAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.addTitle}>{labels.addIntro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="nameEn" label={labels.nameEn} required>
            <input id="nameEn" name="nameEn" required defaultValue="" className={inputClass} />
          </Field>
          <Field id="nameVi" label={labels.nameVi} hint={labels.nameViHint}>
            <input id="nameVi" name="nameVi" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="startDate" label={multiDay ? labels.firstDay : labels.date} required>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={defaultDate}
              className={inputClass}
            />
          </Field>
          {multiDay ? (
            <Field id="endDate" label={labels.lastDay} hint={labels.lastDayHint}>
              <input id="endDate" name="endDate" type="date" className={inputClass} />
            </Field>
          ) : null}
        </div>

        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={multiDay}
            onChange={(e) => setMultiDay(e.target.checked)}
            className="h-4 w-4"
          />
          {labels.multiDay}
        </label>

        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isRecurring" className="h-4 w-4" />
          {labels.recurring}
          <span className="text-mute">{labels.recurringHint}</span>
        </label>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? labels.adding : labels.add}
          </button>
        </div>
      </form>
    </Panel>
  );
}

/** Remove a holiday group. Two-step, because it changes future day counts. */
export function DeleteHolidayButton({
  nameEn,
  startDate,
  endDate,
  labels,
}: {
  nameEn: string;
  startDate: string;
  endDate: string;
  labels: HolidayLabels;
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => deleteHolidayAction(form),
    null
  );

  if (state?.ok) return <Result state={state} />;

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="min-h-[44px] text-sm font-medium text-coral underline-offset-4 hover:underline"
      >
        {labels.remove}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="nameEn" value={nameEn} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />
      <p className="text-sm text-ink/80">{labels.removeIntro}</p>
      <Result state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-coral px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? labels.removing : labels.removeConfirm}
        </button>
        <button type="button" onClick={() => setArmed(false)} className={buttonQuietClass}>
          {labels.keep}
        </button>
      </div>
    </form>
  );
}

/**
 * Compensatory working days and company closures.
 *
 * Kept as its own panel rather than folded into the holiday form because it is
 * the opposite statement. A holiday says "nobody works"; `làm bù` says "this
 * Saturday, everybody does".
 */
export function OverrideForm({
  defaultDate,
  labels,
}: {
  defaultDate: string;
  labels: HolidayLabels;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => setOverrideAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.overrideTitle}>{labels.overrideIntro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="override-date" label={labels.date} required>
            <input
              id="override-date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className={inputClass}
            />
          </Field>
          <Field id="kind" label={labels.onThisDay} required>
            <select id="kind" name="kind" required defaultValue="working" className={inputClass}>
              <option value="working">{labels.optionWorks}</option>
              <option value="closed">{labels.optionClosed}</option>
            </select>
          </Field>
        </div>

        <Field id="override-note" label={labels.note} hint={labels.noteHint}>
          <input id="override-note" name="note" className={inputClass} />
        </Field>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? labels.saving : labels.saveDay}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function RemoveOverrideButton({
  date,
  labels,
}: {
  date: string;
  labels: HolidayLabels;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => removeOverrideAction(form),
    null
  );

  if (state?.ok) return <Result state={state} />;

  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[44px] text-sm font-medium text-coral underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? labels.removing : labels.remove}
      </button>
      <Result state={state} />
    </form>
  );
}
