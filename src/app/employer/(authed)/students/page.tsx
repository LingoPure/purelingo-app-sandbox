import Link from "next/link";
import { loadCohortStudents } from "@/lib/employer/data";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await loadCohortStudents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Roster
          </p>
          <h1 className="font-serif text-3xl text-navy">Students</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Every student in the pilot, with discovery status, current average
            score, and recent activity. Click any row for the full gap profile.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/employer/staff/invite"
            className="rounded-full border border-navy bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-navy hover:bg-mist/40"
          >
            Invite one
          </Link>
          <Link
            href="/employer/staff/import"
            className="rounded-full bg-navy px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90"
          >
            Bulk import →
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-cream bg-paper">
        {students.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-mute">
            No students yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-cream bg-mist/50 text-left">
              <tr>
                <Th>Student</Th>
                <Th>Target</Th>
                <Th>Discovery</Th>
                <Th>Average</Th>
                <Th>Cert</Th>
                <Th>Lessons</Th>
                <Th>Classes</Th>
                <Th>XP</Th>
                <Th>Last active</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-cream last:border-b-0 hover:bg-mist/40"
                >
                  <Td>
                    <Link
                      href={`/employer/students/${s.id}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {s.name?.trim() || s.email || "Unnamed"}
                    </Link>
                    {s.email && s.name && (
                      <p className="font-mono text-[10px] text-mute">
                        {s.email}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Pill>{s.target_level ?? "—"}</Pill>
                  </Td>
                  <Td>
                    <DiscoveryPill status={s.discovery_status} />
                  </Td>
                  <Td>
                    <span
                      className={
                        s.averageScore === null
                          ? "font-mono text-mute"
                          : s.averageScore >= 800
                          ? "font-mono text-ai-green"
                          : s.averageScore >= 600
                          ? "font-mono text-amber"
                          : "font-mono text-coral"
                      }
                    >
                      {s.averageScore ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <CertCell
                      passed={s.highestCert}
                      pending={s.pendingCertLevel}
                    />
                  </Td>
                  <Td>{s.lessonsCompleted}</Td>
                  <Td>{s.classesCompleted}</Td>
                  <Td>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-sm">{s.totalXp}</span>
                      {s.streakDays > 0 && (
                        <span
                          className="font-mono text-[10px] text-mute"
                          title={`${s.streakDays}-day streak`}
                        >
                          🔥{s.streakDays}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {s.lastActivityAt
                      ? new Date(s.lastActivityAt).toLocaleDateString("en-AU", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-mute">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-ink">{children}</td>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream bg-mist/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy">
      {children}
    </span>
  );
}

function CertCell({
  passed,
  pending,
}: {
  passed: string | null;
  pending: string | null;
}) {
  if (passed) {
    return (
      <span className="rounded-full border border-teal/30 bg-teal/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
        {passed}
      </span>
    );
  }
  if (pending) {
    return (
      <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
        {pending} scheduled
      </span>
    );
  }
  return <span className="font-mono text-[10px] text-mute">—</span>;
}

function DiscoveryPill({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    complete: {
      label: "Complete",
      cls: "border-teal/30 bg-teal/5 text-teal",
    },
    in_progress: {
      label: "In progress",
      cls: "border-amber/30 bg-amber/5 text-amber",
    },
    pending: {
      label: "Pending",
      cls: "border-mute/30 bg-mist/40 text-mute",
    },
  };
  const info = map[status ?? "pending"] ?? map.pending;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${info.cls}`}
    >
      {info.label}
    </span>
  );
}
