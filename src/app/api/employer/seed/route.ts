/**
 * Seed the demo cohort. Gated on employer-admin auth. Idempotent.
 */

import { NextResponse } from "next/server";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { seedDemoCohort } from "@/lib/employer/seed-demo";

export async function POST() {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await seedDemoCohort(adminSupabase());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
