// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { loadRolesIndex } from "@/lib/employer/roles-data";
import { SKILL_KEYS } from "@/lib/scoring/rubric";

export const dynamic = "force-dynamic";

const SKILL_LABEL: Record<string, string> = {
  speaking: "Speak",
  listening: "Listen",
  writing: "Write",
  reading: "Read",
  grammar: "Grammar",
  live_interaction: "Interact",
};

export default async function RolesIndexPage() {
  const roles = await loadRolesIndex();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Job architecture
          </p>
          <h1 className="font-serif text-3xl text-navy">Roles</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Each role has six per-skill baselines — the minimum English level
            needed for that position. Students get assigned to a role; the
            scoring engine uses the role&apos;s baseline to calibrate their gap.
          </p>
        </div>
        <Link
          href="/employer/roles/new"
          className="rounded-full bg-navy px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90"
        >
          + New role
        </Link>
      </div>

      {roles.length === 0 ? (
        <section className="rounded-lg border border-dashed border-cream bg-paper p-10 text-center">
          <p className="text-sm text-mute">
            No roles yet. Create your first role to start grouping staff by
            English requirements.
          </p>
        </section>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-cream bg-paper">
          <table className="w-full text-sm">
            <thead className="border-b border-cream bg-mist/50 text-left">
              <tr>
                <Th>Role</Th>
                <Th className="text-center">Staff</Th>
                {SKILL_KEYS.map((k) => (
                  <Th key={k} className="text-center">
                    {SKILL_LABEL[k] ?? k}
                  </Th>
                ))}
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-cream last:border-b-0 hover:bg-mist/40"
                >
                  <Td>
                    <Link
                      href={`/employer/roles/${r.id}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-mute">
                        {r.description}
                      </p>
                    )}
                    {r.isArchived && (
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                        archived
                      </p>
                    )}
                  </Td>
                  <Td className="text-center font-mono text-sm">
                    {r.studentCount}
                  </Td>
                  {SKILL_KEYS.map((k) => (
                    <Td
                      key={k}
                      className="text-center font-mono text-xs text-ink"
                    >
                      {r.baselines[k]}
                    </Td>
                  ))}
                  <Td className="text-right">
                    <Link
                      href={`/employer/roles/${r.id}`}
                      className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
                    >
                      Edit →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-mute ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top text-ink ${className}`}>{children}</td>
  );
}
