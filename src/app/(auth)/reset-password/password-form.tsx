"use client";

import { useState } from "react";
import { updatePassword } from "./actions";

export function PasswordForm() {
  const [show, setShow] = useState(false);

  return (
    <form action={updatePassword} className="flex flex-col gap-4">
      <PasswordField label="New password" name="password" show={show} onToggle={() => setShow((s) => !s)} />
      <PasswordField label="Confirm new password" name="confirm" show={show} onToggle={() => setShow((s) => !s)} />
      <button
        type="submit"
        className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
      >
        Update password
      </button>
    </form>
  );
}

function PasswordField({
  label,
  name,
  show,
  onToggle,
}: {
  label: string;
  name: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={6}
          className="w-full rounded-md border border-cream bg-paper px-3 py-2.5 pr-11 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center text-mute hover:text-navy"
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </label>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
