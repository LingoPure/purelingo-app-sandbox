import Link from "next/link";
import { RoleForm } from "../role-form";
import { emptyBaselines } from "@/lib/employer/roles-data";

export const dynamic = "force-dynamic";

export default function NewRolePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to roles
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">New role</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Set the per-skill baselines that staff in this role need to clear.
          Defaults are 70 across the board (mid-B2). Push the bar higher for
          customer-facing roles, lower for internal-only roles.
        </p>
      </div>

      <RoleForm mode="create" initialBaselines={emptyBaselines()} />
    </div>
  );
}
