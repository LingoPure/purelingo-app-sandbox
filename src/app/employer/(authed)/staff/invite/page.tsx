import Link from "next/link";
import { loadRolesIndex } from "@/lib/employer/roles-data";
import { InviteClient } from "./invite-client";

export const dynamic = "force-dynamic";

export default async function InviteStaffPage() {
  const roles = await loadRolesIndex();

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
          Sends a magic-link email. The candidate clicks once, lands in their
          discovery session, and the role baseline you pick here calibrates
          their gap analysis from the first turn.
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
        />
      )}
    </div>
  );
}
