"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateInvestorProfile } from "./actions";

const card = "space-y-4 rounded-2xl border border-cream bg-paper p-4 sm:p-6";
const fieldInput =
  "min-h-[44px] rounded-md border border-cream bg-paper px-3 text-base text-navy focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20";
const btn = "min-h-[44px] rounded-md bg-navy px-5 text-base font-medium text-paper disabled:opacity-40";

export function ProfileSection({
  initialName,
  initialFirm,
  email,
}: {
  initialName: string;
  initialFirm: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [firm, setFirm] = useState(initialFirm);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const fd = new FormData();
    fd.set("fullName", name);
    fd.set("firm", firm);
    start(async () => {
      const r = await updateInvestorProfile(fd);
      if (r.error) setErr(r.error);
      else setMsg("Saved.");
    });
  }

  return (
    <section className={card}>
      <h2 className="font-serif text-lg text-navy">Profile</h2>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Firm</span>
          <input value={firm} onChange={(e) => setFirm(e.target.value)} className={fieldInput} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input value={email} readOnly className={`${fieldInput} bg-mist text-navy/60`} />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "Saving…" : "Save profile"}
          </button>
          {msg && <span className="text-sm text-teal">{msg}</span>}
          {err && <span className="text-sm text-coral">{err}</span>}
        </div>
      </form>
    </section>
  );
}

export function PasswordSection() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPending(false);
    if (error) setErr(error.message);
    else {
      setMsg("Password updated.");
      setPw("");
      setPw2("");
    }
  }

  return (
    <section className={card}>
      <h2 className="font-serif text-lg text-navy">Password</h2>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">New password</span>
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            className={fieldInput}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Confirm new password</span>
          <input
            type={show ? "text" : "password"}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
            className={fieldInput}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-navy/70">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4" />
          Show password
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={btn}>
            {pending ? "Updating…" : "Update password"}
          </button>
          {msg && <span className="text-sm text-teal">{msg}</span>}
          {err && <span className="text-sm text-coral">{err}</span>}
        </div>
      </form>
    </section>
  );
}

export function AccountSection() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOutEverywhere() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/investor/login");
    router.refresh();
  }

  return (
    <section className={card}>
      <h2 className="font-serif text-lg text-navy">Account</h2>
      <p className="text-sm text-navy/70">
        Sign out everywhere ends every active session on all devices.
      </p>
      <button
        type="button"
        onClick={signOutEverywhere}
        disabled={pending}
        className="min-h-[44px] rounded-md border border-navy/30 bg-paper px-5 text-base font-medium text-navy hover:bg-mist disabled:opacity-40"
      >
        {pending ? "Signing out…" : "Sign out of all devices"}
      </button>
    </section>
  );
}
