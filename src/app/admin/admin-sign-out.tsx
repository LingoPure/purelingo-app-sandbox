"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminSignOut() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex min-h-[44px] w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-mute transition hover:bg-mist hover:text-navy"
    >
      Sign out
    </button>
  );
}
