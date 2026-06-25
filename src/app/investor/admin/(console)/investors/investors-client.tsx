"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteInvestor,
  setInvestorStatus,
  setDeepDiveEligibility,
  type InvestorRecord,
  type ActionResult,
} from "./actions";

export type InvestorRow = InvestorRecord;

const card = "rounded-2xl border border-cream bg-paper p-4 sm:p-6";
const input =
  "min-h-[44px] w-full rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20";
const btn = "min-h-[44px] rounded-md bg-navy px-5 text-base font-medium text-paper disabled:opacity-40";

export function InvestorsManager({ investors }: { investors: InvestorRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  // Local copy so console actions repaint the list immediately (each action
  // returns the fresh list). Re-sync to new server props via the render-time
  // pattern (no effect) so a router.refresh / navigation still updates it.
  const [rows, setRows] = useState<InvestorRow[]>(investors);
  const [seenProp, setSeenProp] = useState(investors);
  if (seenProp !== investors) {
    setSeenProp(investors);
    setRows(investors);
  }

  function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setInviteLink(null);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    start(async () => {
      const r = await inviteInvestor(fd);
      if (r.error) setErr(r.error);
      else {
        setMsg(
          r.emailed
            ? "Investor invited — sign-in link emailed to them."
            : "Investor invited. Email wasn't sent — copy the link below and send it."
        );
        if (r.inviteLink) setInviteLink(r.inviteLink);
        if (r.rows) setRows(r.rows);
        form.reset();
        router.refresh();
      }
    });
  }

  function rowAction(fn: () => Promise<ActionResult>) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else {
        if (r.rows) setRows(r.rows);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Invite */}
      <section className={card}>
        <h2 className="mb-3 font-serif text-lg text-navy">Invite an investor</h2>
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
          <input name="email" type="email" required placeholder="investor@firm.com" className={input} aria-label="Email" />
          <input name="firm" type="text" placeholder="Firm (optional)" className={input} aria-label="Firm" />
          <input name="fullName" type="text" placeholder="Name (optional)" className={input} aria-label="Name" />
          <select name="access" defaultValue="main" className={input} aria-label="Access">
            <option value="main">Dataroom only (no NDA)</option>
            <option value="deepdive">Dataroom + deep dive (NDA-gated)</option>
          </select>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={pending} className={btn}>
              {pending ? "Inviting…" : "Invite investor"}
            </button>
            {msg && <span className="text-sm text-teal">{msg}</span>}
            {err && <span className="text-sm text-coral">{err}</span>}
          </div>
        </form>
        {inviteLink && (
          <div className="mt-3 space-y-1 rounded-md border border-teal/30 bg-teal/10 p-3">
            <p className="text-sm font-medium text-navy">One-time sign-in link — send this to the investor:</p>
            <code className="block overflow-x-auto whitespace-nowrap rounded bg-paper px-2 py-1 text-xs text-navy/80">
              {inviteLink}
            </code>
          </div>
        )}
      </section>

      {/* List */}
      <section className={card}>
        <h2 className="mb-3 font-serif text-lg text-navy">All investors ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-navy/60">No investors yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-mist text-left">
                <tr>
                  <th className="px-2 py-2 font-medium text-navy">Investor</th>
                  <th className="px-2 py-2 font-medium text-navy">Deep dive</th>
                  <th className="px-2 py-2 font-medium text-navy">NDA</th>
                  <th className="px-2 py-2 font-medium text-navy">Status</th>
                  <th className="px-2 py-2 font-medium text-navy">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-t border-cream align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium text-navy">{inv.email}</div>
                      <div className="text-xs text-navy/50">{inv.firm ?? inv.full_name ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2">
                      {!inv.deep_dive_invited ? (
                        <span className="rounded bg-mist px-2 py-0.5 text-xs text-navy/50">not eligible</span>
                      ) : inv.max_tier === "restricted" ? (
                        <span className="rounded bg-gold/15 px-2 py-0.5 text-xs text-navy">unlocked</span>
                      ) : (
                        <span className="rounded bg-mist px-2 py-0.5 text-xs text-navy/70">eligible · awaiting NDA</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-navy/70">
                      {inv.nda_accepted_at ? new Date(inv.nda_accepted_at).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <span className={inv.status === "active" ? "text-teal" : "text-coral"}>{inv.status}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {!inv.deep_dive_invited ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => rowAction(() => setDeepDiveEligibility(inv.id, true))}
                            className="rounded border border-navy/20 px-2 py-1 text-xs text-navy hover:bg-mist disabled:opacity-40"
                          >
                            Allow deep dive
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Remove ${inv.email}'s deep-dive eligibility? Any current deep-dive access is pulled back to main.`))
                                rowAction(() => setDeepDiveEligibility(inv.id, false));
                            }}
                            className="rounded border border-navy/20 px-2 py-1 text-xs text-navy hover:bg-mist disabled:opacity-40"
                          >
                            Remove deep dive
                          </button>
                        )}
                        {inv.status === "active" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Revoke ${inv.email}'s dataroom access? They will be blocked immediately.`))
                                rowAction(() => setInvestorStatus(inv.id, "revoked"));
                            }}
                            className="rounded border border-coral/40 px-2 py-1 text-xs text-coral hover:bg-coral/10 disabled:opacity-40"
                          >
                            Revoke access
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => rowAction(() => setInvestorStatus(inv.id, "active"))}
                            className="rounded border border-navy/20 px-2 py-1 text-xs text-navy hover:bg-mist disabled:opacity-40"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
