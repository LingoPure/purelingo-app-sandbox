"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  previewAdjustmentAction,
  applyAdjustmentAction,
  type PreviewState,
} from "../../balance-actions";
import type { ActionResult } from "../../actions";
import {
  Field,
  Panel,
  PanelHeader,
  inputClass,
  buttonPrimaryClass,
} from "../../ui";

export type BalanceLabels = Record<string, string>;

export type BalanceRow = {
  leaveTypeId: string;
  name: string;
  remaining: number;
  allowance: number | null;
  taken: number;
};

/**
 * Adjust one employee's balance.
 *
 * Four actions, and two of them are genuinely different operations rather than
 * variants of the same one:
 *
 *   add / deduct / set   move the BALANCE, by writing a ledger row
 *   allowance            changes the ENTITLEMENT, and writes no ledger row
 *
 * The form says so explicitly, because "set the balance to 14" and "change
 * their allowance to 14" look identical in a dropdown and mean different things
 * to the person on the other end of it.
 */
export function AdjustBalancePanel({
  employeeId,
  leaveYear,
  balances,
  today,
  labels,
}: {
  employeeId: string;
  leaveYear: number;
  balances: BalanceRow[];
  today: string;
  labels: BalanceLabels;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(balances[0]?.leaveTypeId ?? "");
  const [action, setAction] = useState("add");
  const [value, setValue] = useState("");

  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [previewPending, startPreview] = useTransition();

  const [state, formAction, saving] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => {
      const result = await applyAdjustmentAction(form);
      if (result.ok) setValue("");
      return result;
    },
    null
  );

  // The resulting balance depends on the CURRENT balance, which only the server
  // knows — "set to 10" is a different movement for every employee.
  //
  // The empty-input case is DERIVED at render rather than pushed into state
  // here. Clearing the field by calling setPreview inside the effect costs a
  // second render pass on every keystroke, which is what React flags; whether
  // to show the box is a function of the current input, so it is computed as
  // one.
  const hasValue = value.trim() !== "";

  useEffect(() => {
    if (!leaveTypeId || value.trim() === "") return;
    startPreview(async () => {
      setPreview(
        await previewAdjustmentAction(employeeId, leaveTypeId, leaveYear, action, value)
      );
    });
  }, [employeeId, leaveTypeId, leaveYear, action, value]);

  const isAllowance = action === "allowance";
  const hint =
    action === "add"
      ? labels.actionAddHint
      : action === "deduct"
        ? labels.actionDeductHint
        : action === "set"
          ? labels.actionSetHint
          : labels.actionAllowanceHint;

  return (
    <Panel className="mb-6">
      <PanelHeader title={labels.adjustTitle}>{labels.adjustIntro}</PanelHeader>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="leaveYear" value={leaveYear} />

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="adj-type" label={labels.leaveType} required>
            <select
              id="adj-type"
              name="leaveTypeId"
              required
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={inputClass}
            >
              {balances.map((b) => (
                <option key={b.leaveTypeId} value={b.leaveTypeId}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>

          <Field id="adj-action" label={labels.action} required hint={hint}>
            <select
              id="adj-action"
              name="action"
              required
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className={inputClass}
            >
              <option value="add">{labels.actionAdd}</option>
              <option value="deduct">{labels.actionDeduct}</option>
              <option value="set">{labels.actionSet}</option>
              <option value="allowance">{labels.actionAllowance}</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="adj-value" label={isAllowance ? labels.newAllowance : labels.days} required>
            <input
              id="adj-value"
              name="value"
              type="number"
              min="0"
              step="0.5"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* An allowance change is not dated the way a movement is — it is the
              entitlement for the whole leave year. */}
          {!isAllowance ? (
            <Field id="adj-date" label={labels.effectiveDate} hint={labels.effectiveHint}>
              <input
                id="adj-date"
                name="effectiveDate"
                type="date"
                defaultValue={today}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>

        <Field id="adj-reason" label={labels.reason} required hint={labels.reasonHint}>
          <input id="adj-reason" name="reason" required className={inputClass} />
        </Field>

        {hasValue ? (
          <PreviewBox preview={preview} pending={previewPending} labels={labels} />
        ) : null}

        {state && !state.ok ? (
          <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="rounded-md bg-ai-green/10 px-4 py-3 text-sm text-ai-green">
            {state.message}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={saving || previewPending}
            className={`${buttonPrimaryClass} disabled:opacity-60`}
          >
            {saving ? labels.applying : labels.apply}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function PreviewBox({
  preview,
  pending,
  labels,
}: {
  preview: PreviewState;
  pending: boolean;
  labels: BalanceLabels;
}) {
  if (preview.status === "idle") return null;

  if (preview.status === "error") {
    return (
      <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
        {preview.error}
      </p>
    );
  }

  const p = preview.preview;
  const isAllowanceChange = p.allowanceBefore !== p.allowanceAfter;

  return (
    <div
      aria-live="polite"
      className={`rounded-md border border-cream bg-mist/60 px-4 py-4 ${pending ? "opacity-60" : ""}`}
    >
      {p.noop ? (
        <p className="text-sm text-mute">{labels.previewNoChange}</p>
      ) : isAllowanceChange ? (
        <>
          <p className="text-lg font-medium text-navy">
            {labels.previewAllowance
              .replace("{before}", String(p.allowanceBefore ?? "—"))
              .replace("{after}", String(p.allowanceAfter ?? "—"))}
          </p>
          {/* Stated every time. It is the single most likely misunderstanding
              on this form. */}
          <p className="mt-1 text-sm text-mute">{labels.previewAllowanceNote}</p>
        </>
      ) : (
        <p className="text-lg font-medium text-navy">
          {labels.previewBalance
            .replace("{before}", String(p.balanceBefore))
            .replace("{after}", String(p.balanceAfter))}
        </p>
      )}
    </div>
  );
}
