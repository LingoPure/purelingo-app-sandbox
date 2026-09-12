"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch("/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-md border border-paper/20 px-3 py-1.5 text-xs font-medium text-paper hover:bg-paper/10 disabled:opacity-50"
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}