import Link from "next/link";
import { loadCohortStudents } from "@/lib/employer/data";
import { StudentsTable, type RosterRow } from "./students-table";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await loadCohortStudents();
  const rows: RosterRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    target_level: s.target_level,
    discovery_status: s.discovery_status,
    averageScore: s.averageScore,
    totalXp: s.totalXp,
    streakDays: s.streakDays,
    lessonsCompleted: s.lessonsCompleted,
    classesCompleted: s.classesCompleted,
    lastActivityAt: s.lastActivityAt,
    highestCert: s.highestCert,
    pendingCertLevel: s.pendingCertLevel,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
            Roster
          </p>
          <h1 className="font-serif text-3xl text-navy">Registered Professionals</h1>
          <p className="mt-2 max-w-2xl text-sm text-mute">
            Every professional member in the programme, with assessment status, current average
            score, and CPD activity. Tick rows to bulk-send invites, or use
            the per-row Send button. Click any member for the full gap profile.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/employer/staff/invite"
            className="rounded-full border border-navy bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-navy hover:bg-mist/40"
          >
            Invite Professional Member
          </Link>
          <Link
            href="/employer/staff/import"
            className="rounded-full bg-navy px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-paper hover:bg-navy/90"
          >
            Bulk import →
          </Link>
        </div>
      </div>

      <StudentsTable rows={rows} />
    </div>
  );
}
