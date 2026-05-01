import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleForm } from "../role-form";
import { loadRoleDetail } from "@/lib/employer/roles-data";

export const dynamic = "force-dynamic";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await loadRoleDetail(id);
  if (!role) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to roles
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">{role.name}</h1>
        {role.description && (
          <p className="mt-2 max-w-2xl text-sm text-mute">{role.description}</p>
        )}
      </div>

      <RoleForm
        mode="edit"
        roleId={role.id}
        initialName={role.name}
        initialDescription={role.description}
        initialBaselines={role.baselines}
        initialIsArchived={role.isArchived}
      />

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-navy">Assigned staff</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
            {role.assignedStudents.length} total
          </p>
        </div>
        {role.assignedStudents.length === 0 ? (
          <p className="text-sm text-mute">
            Nobody is assigned to this role yet. Bulk-import staff from the
            students page.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-cream">
            {role.assignedStudents.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {s.name?.trim() || s.email || "Unnamed"}
                  </p>
                  {s.email && s.name && (
                    <p className="font-mono text-[10px] text-mute">
                      {s.email}
                    </p>
                  )}
                </div>
                <Link
                  href={`/employer/students/${s.id}`}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
