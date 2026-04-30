/**
 * Seed the demo cohort. Gated by the employer cookie (the same gate that
 * protects /employer/*). Idempotent — safe to re-run.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  EMPLOYER_COOKIE_NAME,
  cookieIsValid,
} from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { seedDemoCohort } from "@/lib/employer/seed-demo";

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(EMPLOYER_COOKIE_NAME)?.value;
  if (!(await cookieIsValid(cookie))) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  try {
    const result = await seedDemoCohort(adminSupabase());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
