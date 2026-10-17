/**
 * GET /api/employer/roles/discovery/status?roleId=... — poll target for
 * the post-interview screen. The webhook's role-discovery branch scores
 * the session async relative to the browser, so the screen polls here
 * rather than racing it with a blind redirect (mirrors
 * /api/onboarding/discovery/status's role for the student flow).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";

export async function GET(request: NextRequest) {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) return auth;

  const roleId = request.nextUrl.searchParams.get("roleId");
  if (!roleId) {
    return NextResponse.json({ error: "roleId required" }, { status: 400 });
  }

  const supabase = adminSupabase();
  const { data } = await supabase
    .from("role_discovery_sessions")
    .select("status, scored_at")
    .eq("role_id", roleId)
    .eq("employer_id", auth.admin.employerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { status?: string; scored_at?: string | null } | null;
  const complete = Boolean(row?.scored_at) || row?.status === "failed";

  return NextResponse.json({
    status: row?.status ?? "pending",
    complete,
    failed: row?.status === "failed" && !row?.scored_at,
  });
}
