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

/**
 * Add a public holiday.
 *
 * A single date field plus an optional last day, rather than two required
 * dates: most holidays are one day, and making everyone enter the same date
 * twice for the common case to serve Tết is the wrong trade.
 */
export function AddHolidayForm({ defaultDate }: { defaultDate: string }) {
  const [multiDay, setMultiDay] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => createHolidayAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title="Add a public holiday">
        Days on this list are never deducted from anyone&rsquo;s leave, and a
        leave request spanning one does not count it. Staff are emailed in
        advance.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="nameEn" label="Name (English)" required>
            <input id="nameEn" name="nameEn" required defaultValue="" className={inputClass} />
          </Field>
          <Field id="nameVi" label="Name (Tiếng Việt)" hint="Falls back to the English name.">
            <input id="nameVi" name="nameVi" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="startDate" label={multiDay ? "First day" : "Date"} required>
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
            <Field id="endDate" label="Last day" hint="Tết usually runs five days.">
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
          This holiday runs for more than one day
        </label>

        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="isRecurring" className="h-4 w-4" />
          Falls on the same date every year
          <span className="text-mute">
            (National Day does; Tết does not — it moves with the lunar calendar)
          </span>
        </label>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Adding…" : "Add holiday"}
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
}: {
  nameEn: string;
  startDate: string;
  endDate: string;
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
        Remove
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="nameEn" value={nameEn} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="endDate" value={endDate} />
      <p className="text-sm text-ink/80">
        Removing this means future leave requests will count these days again.
        Leave already approved keeps the day count it was approved on.
      </p>
      <Result state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-coral px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Removing…" : "Yes, remove it"}
        </button>
        <button type="button" onClick={() => setArmed(false)} className={buttonQuietClass}>
          Keep it
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
export function OverrideForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => setOverrideAction(form),
    null
  );

  return (
    <Panel className="mb-6">
      <PanelHeader title="Compensatory and closure days">
        Use this when a Saturday is worked to bridge a holiday (làm bù), or when
        the office closes on a day that is not a public holiday. Both change how
        leave is counted that week.
      </PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="override-date" label="Date" required>
            <input
              id="override-date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className={inputClass}
            />
          </Field>
          <Field id="kind" label="On this day" required>
            <select id="kind" name="kind" required defaultValue="working" className={inputClass}>
              <option value="working">Everybody works (làm bù)</option>
              <option value="closed">The office is closed</option>
            </select>
          </Field>
        </div>

        <Field id="override-note" label="Note" hint="Why, for whoever reads this next year.">
          <input id="override-note" name="note" className={inputClass} />
        </Field>

        <Result state={state} />

        <div>
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} disabled:opacity-60`}>
            {pending ? "Saving…" : "Save this day"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function RemoveOverrideButton({ date }: { date: string }) {
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
        {pending ? "Removing…" : "Remove"}
      </button>
      <Result state={state} />
    </form>
  );
}
