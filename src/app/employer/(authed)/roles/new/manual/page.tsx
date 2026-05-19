// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { RoleForm } from "../../role-form";
import { emptyBaselines } from "@/lib/employer/roles-data";

export const dynamic = "force-dynamic";

export default function NewRoleManualPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles/new"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Choose a different path
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">New role — manual</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Set the per-skill baselines yourself. Defaults are 700 across the
          board (mid-B2 on the 0–1000 scale). Push the bar higher for
          customer-facing roles, lower for internal-only roles.
        </p>
      </div>

      <RoleForm mode="create" initialBaselines={emptyBaselines()} />
    </div>
  );
}
