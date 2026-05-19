// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { loadRolesIndex } from "@/lib/employer/roles-data";
import { loadEmployerStaffPicks } from "@/lib/employer/data";
import { adminSupabase } from "@/lib/employer/data";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import {
  isLanguageCode,
  type LanguageCode,
} from "@/lib/i18n/dictionary";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";

async function loadEmployerDefaultLang(
  employerId: string
): Promise<LanguageCode> {
  const { data } = await adminSupabase()
    .from("employers")
    .select("default_native_language")
    .eq("id", employerId)
    .maybeSingle();
  const code = (data as { default_native_language?: string } | null)
    ?.default_native_language;
  return isLanguageCode(code) ? code : "vi";
}

export default async function InviteStaffPage() {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) {
    // requireEmployerAdmin returned a 401/403 — we're rendering a page,
    // not a route handler, so redirect to login instead.
    redirect("/login?redirectTo=/employer/staff/invite");
  }
  const employerId = auth.admin.employerId;

  const [roles, picks, defaultLang] = await Promise.all([
    loadRolesIndex(),
    loadEmployerStaffPicks(),
    loadEmployerDefaultLang(employerId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/students"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to students
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">Invite a staff member</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Pick an employee already in your roster, or fill in details to add
          someone new. Either way, sends a magic-link email — they click once
          and land in their discovery session, calibrated to the role baseline.
        </p>
      </div>

      {roles.length === 0 ? (
        <section className="rounded-lg border border-dashed border-cream bg-paper p-8 text-center">
          <p className="text-sm text-coral">
            No roles configured yet.{" "}
            <Link href="/employer/roles/new" className="underline">
              Create one first
            </Link>
            .
          </p>
        </section>
      ) : (
        <InviteClient
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          existingStaff={picks}
          defaultNativeLanguage={defaultLang}
        />
      )}
    </div>
  );
}
