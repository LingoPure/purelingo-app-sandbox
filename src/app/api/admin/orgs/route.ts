/**
 * POST /api/admin/orgs — platform-admin "Add client org".
 *
 * Gates on the platform-admins table (requirePlatformAdmin, canonical), then
 * creates the org owned by the client contact and returns a copy-pasteable
 * invite link that lands the owner directly inside the onboarding wizard.
 * Best-effort email (RESEND_API_KEY); the link is always returned.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientOrganisation } from "@/lib/org/service";
import { SERVICE_PACKAGES } from "@/lib/org/onboarding";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).optional(),
  package: z.enum(SERVICE_PACKAGES).optional(),
  ownerEmail: z.string().trim().email().max(254).optional(),
  ownerName: z.string().trim().min(1).max(120).optional(),
});

export async function POST(request: Request) {
  const guard = await requirePlatformAdmin();
  if (guard instanceof NextResponse) return guard;
  const { user } = guard;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  const origin =
    request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const result = await createClientOrganisation(
      createAdminClient(),
      user.id,
      body,
      { origin }
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 500 }
    );
  }
}