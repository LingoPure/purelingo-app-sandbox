"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperatorSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await fetch("/auth/signout", { method: "POST" });
    router.push("/investor/admin/login");
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
