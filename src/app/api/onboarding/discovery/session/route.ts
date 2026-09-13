import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ariaDiscovery } from "@/lib/onboarding/aria-discovery";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await ariaDiscovery.startSession(user.id);
    return NextResponse.json(session);
  } catch (err) {
    console.error("discovery session start failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 500 }
    );
  }
}