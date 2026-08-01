"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { previewRequestAction, submitRequestAction, type PreviewState } from "../../request-actions";
import type { ActionResult } from "../../actions";
import { Field, Panel, inputClass, buttonPrimaryClass } from "../../ui";
import type { HrLeaveType } from "@/lib/hr/types";

/**
 * Leave request form with a live day count.
 *
 * The requirement asks the form to show the number of days requested and the
 * expected balance after approval, before submission. That figure cannot be
 * computed in the browser: it depends on the working pattern, the public
 * holiday calendar and the `làm bù` overrides, all of which live in the
 * database. So each change re-asks the server.
 *
 * Why the count is worth showing at all: a Friday-to-Monday request costs 2
 * days, not 4, and to anyone who has not thought about it that looks like a
 * bug. The explanation line pre-empts the question rather than waiting for it
 * to arrive as a complaint.
 */
export function RequestForm({
  employeeId,
  leaveTypes,
  today,
}: {
  employeeId: string;
  leaveTypes: HrLeaveType[];
  today: string;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startHalf, setStartHalf] = useState("");
  const [endHalf, setEndHalf] = useState("");

  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const [previewPending, startPreview] = useTransition();

  const [state, formAction, submitting] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => submitRequestAction(form),
    null
  );

  /**
   * Keep the end on or after the start.
   *
   * Done in the handler rather than in an effect. Syncing one piece of state
   * from another inside an effect causes a second render pass for every
   * keystroke, and React flags it for exactly that reason. Correcting silently
   * here is also kinder than rendering a validation error at someone who has
   * not finished picking their dates.
   */
  function onStartDateChange(value: string) {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  }

  const singleDay = startDate === endDate;

  useEffect(() => {
    if (!leaveTypeId || !startDate || !endDate) return;
    startPreview(async () => {
      const result = await previewRequestAction(
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        startHalf || null,
        singleDay ? null : endHalf || null
      );
      setPreview(result);
    });
  }, [employeeId, leaveTypeId, startDate, endDate, startHalf, endHalf, singleDay]);

  const ready = preview.status === "ready" ? preview.preview : null;
  const blocked = (ready?.blockers.length ?? 0) > 0;

  return (
    <Panel>
      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="employeeId" value={employeeId} />

        <Field id="leaveTypeId" label="Leave type" required>
          <select
            id="leaveTypeId"
            name="leaveTypeId"
            required
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className={inputClass}
          >
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.nameEn}
                {type.deductsBalance ? "" : " (does not use your balance)"}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="startDate" label="First day" required>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field id="endDate" label="Last day" required>
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="startHalf"
            label={singleDay ? "Half day?" : "First day — half day?"}
            hint={singleDay ? "Leave as a full day, or take a morning or afternoon." : undefined}
          >
            <select
              id="startHalf"
              name="startHalf"
              value={startHalf}
              onChange={(e) => setStartHalf(e.target.value)}
              className={inputClass}
            >
              <option value="">Full day</option>
              <option value="am">Morning only</option>
              <option value="pm">Afternoon only</option>
            </select>
          </Field>

          {/* A half day only makes sense at the ends of a range, so the second
              control is hidden entirely on a single-day request rather than
              shown and ignored. */}
          {!singleDay ? (
            <Field id="endHalf" label="Last day — half day?">
              <select
                id="endHalf"
                name="endHalf"
                value={endHalf}
                onChange={(e) => setEndHalf(e.target.value)}
                className={inputClass}
              >
                <option value="">Full day</option>
                <option value="am">Morning only</option>
                <option value="pm">Afternoon only</option>
              </select>
            </Field>
          ) : null}
        </div>

        <Field id="reason" label="Reason" hint="Your manager sees this. Colleagues do not.">
          <textarea id="reason" name="reason" rows={3} className={`${inputClass} min-h-[88px] py-2`} />
        </Field>

        <PreviewBox preview={preview} pending={previewPending} />

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
            disabled={submitting || blocked || previewPending}
            className={`${buttonPrimaryClass} disabled:opacity-60`}
          >
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function PreviewBox({ preview, pending }: { preview: PreviewState; pending: boolean }) {
  if (preview.status === "idle") return null;

  if (preview.status === "error") {
    return (
      <p role="alert" className="rounded-md bg-coral/10 px-4 py-3 text-sm text-coral">
        {preview.error}
      </p>
    );
  }

  const p = preview.preview;

  return (
    <div
      aria-live="polite"
      className={`rounded-md border px-4 py-4 ${
        p.blockers.length > 0 ? "border-coral/30 bg-coral/5" : "border-cream bg-mist/60"
      } ${pending ? "opacity-60" : ""}`}
    >
      <p className="text-lg font-medium text-navy">
        {p.days} {p.days === 1 ? "day" : "days"}
      </p>

      {p.explanation ? (
        <p className="mt-1 text-sm text-mute">{p.explanation}</p>
      ) : null}

      {p.deductsBalance ? (
        <p className="mt-2 text-sm text-ink">
          Balance after approval:{" "}
          <span className="font-medium">
            {p.balanceAfter} {p.balanceAfter === 1 ? "day" : "days"}
          </span>{" "}
          <span className="text-mute">(from {p.balanceBefore})</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-mute">
          This type does not draw down your paid leave balance.
        </p>
      )}

      {p.warnings.map((warning) => (
        <p key={warning} className="mt-2 text-sm text-gold">
          {warning}
        </p>
      ))}
      {p.blockers.map((blocker) => (
        <p key={blocker} role="alert" className="mt-2 text-sm font-medium text-coral">
          {blocker}
        </p>
      ))}
    </div>
  );
}
