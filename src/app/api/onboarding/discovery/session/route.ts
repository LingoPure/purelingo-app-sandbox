import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ariaDiscovery } from "@/lib/onboarding/aria-discovery";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // In standard discovery-agent pattern, we start a session for the user
  const session = await ariaDiscovery.startSession(user.id);
  
  return NextResponse.json(session);
}
