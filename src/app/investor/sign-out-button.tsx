"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvestorSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch("/auth/signout", { method: "POST" });
    // Phase 3 repoints this to /investor/login once the investor auth flow lands.
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex min-h-[44px] items-center rounded-md border border-paper/20 px-3 text-sm font-medium text-paper hover:bg-paper/10 disabled:opacity-50"
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}
