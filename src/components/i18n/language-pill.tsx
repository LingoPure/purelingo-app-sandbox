"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "@/lib/i18n/dictionary";

type Props = {
  current: LanguageCode;
  /** Light styling for dark headers, dark for light headers. */
  tone?: "light" | "dark";
};

export function LanguagePill({ current, tone = "dark" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active =
    SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[5];

  async function pick(code: LanguageCode) {
    setOpen(false);
    if (code === current) return;
    await fetch("/api/i18n/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    startTransition(() => router.refresh());
  }

  const buttonStyles =
    tone === "light"
      ? "border-paper/20 text-paper hover:bg-paper/10"
      : "border-cream text-navy hover:bg-mist";

  const menuStyles =
    tone === "light"
      ? "border-paper/15 bg-navy text-paper"
      : "border-cream bg-paper text-ink";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${buttonStyles}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span aria-hidden>{active.flag}</span>
        <span>{active.name}</span>
        <span aria-hidden className="opacity-60">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute right-0 z-50 mt-1 flex min-w-[180px] flex-col rounded-md border shadow-lg ${menuStyles}`}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => pick(l.code)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:opacity-80 ${
                  l.code === current ? "font-semibold" : ""
                }`}
                role="option"
                aria-selected={l.code === current}
              >
                <span aria-hidden>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
