"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteInvestor, setInvestorStatus, setInvestorTier } from "./actions";

export type InvestorRow = {
  id: string;
  email: string;
  full_name: string | null;
  firm: string | null;
  max_tier: "main" | "restricted";
  status: "active" | "revoked";
  nda_accepted_at: string | null;
  created_at: string;
};

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
        setMsg("Investor invited.");
        if (r.inviteLink) setInviteLink(r.inviteLink);
        form.reset();
        router.refresh();
      }
    });
  }

  function rowAction(fn: () => Promise<{ error?: string }>) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else router.refresh();
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
          <select name="tier" defaultValue="main" className={input} aria-label="Tier">
            <option value="main">Main dataroom (no NDA)</option>
            <option value="restricted">Deep dive (pre-grant)</option>
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
        <h2 className="mb-3 font-serif text-lg text-navy">All investors ({investors.length})</h2>
        {investors.length === 0 ? (
          <p className="text-sm text-navy/60">No investors yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-mist text-left">
                <tr>
                  <th className="px-2 py-2 font-medium text-navy">Investor</th>
                  <th className="px-2 py-2 font-medium text-navy">Tier</th>
                  <th className="px-2 py-2 font-medium text-navy">NDA</th>
                  <th className="px-2 py-2 font-medium text-navy">Status</th>
                  <th className="px-2 py-2 font-medium text-navy">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investors.map((inv) => (
                  <tr key={inv.id} className="border-t border-cream align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium text-navy">{inv.email}</div>
                      <div className="text-xs text-navy/50">{inv.firm ?? inv.full_name ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={inv.max_tier === "restricted" ? "rounded bg-gold/15 px-2 py-0.5 text-xs text-navy" : "rounded bg-mist px-2 py-0.5 text-xs text-navy/70"}>
                        {inv.max_tier === "restricted" ? "deep dive" : "main"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-navy/70">
                      {inv.nda_accepted_at ? new Date(inv.nda_accepted_at).toISOString().slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <span className={inv.status === "active" ? "text-teal" : "text-coral"}>{inv.status}</span>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        {inv.max_tier === "main" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => rowAction(() => setInvestorTier(inv.id, "restricted"))}
                            className="rounded border border-navy/20 px-2 py-1 text-xs text-navy hover:bg-mist disabled:opacity-40"
                          >
                            Grant deep dive
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => rowAction(() => setInvestorTier(inv.id, "main"))}
                            className="rounded border border-navy/20 px-2 py-1 text-xs text-navy hover:bg-mist disabled:opacity-40"
                          >
                            Revoke deep dive
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
