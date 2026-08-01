"use client";

import { useActionState, useState } from "react";
import {
  cancelRequestAction,
  approveRequestAction,
  declineRequestAction,
} from "../request-actions";
import type { ActionResult } from "../actions";
import {
  Field,
  inputClass,
  buttonPrimaryClass,
  buttonQuietClass,
  buttonDangerClass,
} from "../ui";

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="mt-2 rounded-md bg-ai-green/10 px-3 py-2 text-sm text-ai-green">
      {state.message ?? "Done."}
    </p>
  ) : (
    <p role="alert" className="mt-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral">
      {state.error}
    </p>
  );
}

/**
 * Cancel your own request.
 *
 * Two-step, because cancelling approved leave puts days back and un-books the
 * time — recoverable, but not something to trigger with a stray tap on a phone.
 */
export function CancelRequestButton({
  requestId,
  wasApproved,
}: {
  requestId: string;
  wasApproved: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => cancelRequestAction(form),
    null
  );

  if (state?.ok) return <Result state={state} />;

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="inline-flex min-h-[44px] items-center text-sm font-medium text-coral underline-offset-4 hover:underline"
      >
        Cancel this request
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="text-sm text-ink/80">
        {wasApproved
          ? "This was approved, so the days go back into your balance and the time is no longer booked."
          : "This is still waiting for a decision. Cancelling withdraws it."}
      </p>
      <Field id={`cancel-reason-${requestId}`} label="Reason (optional)">
        <input id={`cancel-reason-${requestId}`} name="reason" className={inputClass} />
      </Field>
      <Result state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" disabled={pending} className={`${buttonDangerClass} disabled:opacity-60`}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button type="button" onClick={() => setArmed(false)} className={buttonQuietClass}>
          Keep it
        </button>
      </div>
    </form>
  );
}

/**
 * Approve or decline, from the queue.
 *
 * Approving is one click; declining requires a reason, because a decline with
 * no explanation is the thing people actually complain about and the person
 * receiving it cannot ask the system why.
 *
 * Both paths can legitimately fail with "already decided by someone else" —
 * both the assigned manager and a Super Admin see the same queue. That is
 * surfaced as an ordinary message rather than an error, because it is not one.
 */
export function DecideButtons({ requestId }: { requestId: string }) {
  const [declining, setDeclining] = useState(false);

  const [approveState, approveAction, approving] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => approveRequestAction(form),
    null
  );
  const [declineState, declineAction, decliningPending] = useActionState(
    async (_prev: ActionResult | null, form: FormData) => declineRequestAction(form),
    null
  );

  if (approveState?.ok) return <Result state={approveState} />;
  if (declineState?.ok) return <Result state={declineState} />;

  return (
    <div className="mt-3">
      {!declining ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={approveAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <button type="submit" disabled={approving} className={`${buttonPrimaryClass} disabled:opacity-60`}>
              {approving ? "Approving…" : "Approve"}
            </button>
          </form>
          <button type="button" onClick={() => setDeclining(true)} className={buttonQuietClass}>
            Decline…
          </button>
        </div>
      ) : (
        <form action={declineAction} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <Field
            id={`decline-note-${requestId}`}
            label="Why are you declining?"
            required
            hint="They will see this."
          >
            <input id={`decline-note-${requestId}`} name="note" required className={inputClass} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={decliningPending}
              className={`${buttonDangerClass} disabled:opacity-60`}
            >
              {decliningPending ? "Declining…" : "Decline"}
            </button>
            <button type="button" onClick={() => setDeclining(false)} className={buttonQuietClass}>
              Back
            </button>
          </div>
        </form>
      )}

      <Result state={approveState} />
      <Result state={declineState} />
    </div>
  );
}
