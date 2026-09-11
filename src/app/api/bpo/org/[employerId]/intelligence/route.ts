/**
 * GET /api/bpo/org/[employerId]/intelligence — §12 Management rollup (BH-006).
 *
 * Returns controlled organizational intelligence for the target architecture's
 * BPO Team / Management Layer: overall capability, capability by role/team,
 * common communication gaps, training demand, and improvement trend.
 *
 * AUTH: employer-admin only. The requesting user must have an
 * `employer_admins` row whose employer_id equals the route's employerId —
 * organisational intelligence is not handed to any authenticated user.
 */
import { NextResponse } from "next/server";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrgIntelligence } from "@/lib/bpo/intelligence";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ employerId: string }> }
) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;

  const { employerId } = await ctx.params;
  if (auth.admin.employerId !== employerId) {
    return NextResponse.json(
      { error: "Not authorised for this employer" },
      { status: 403 }
    );
  }

  try {
    const intelligence = await loadOrgIntelligence(createAdminClient(), employerId);
    return NextResponse.json(intelligence);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}