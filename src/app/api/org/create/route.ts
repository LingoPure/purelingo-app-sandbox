/**
 * POST /api/org/create — C3 step P0: create an organisation.
 *
 * Any signed-in user may create an organisation; they become its owner.
 * Creates: organisations + owner membership + default synthetic subscription
 * + onboarding state row (step=package).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrganisation } from "@/lib/org/service";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { name?: string; slug?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Organisation name is required" }, { status: 400 });
  }

  try {
    const result = await createOrganisation(createAdminClient(), user.id, {
      name,
      slug: body.slug,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}