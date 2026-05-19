// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTeacherDetail } from "@/lib/employer/teachers-data";

export const dynamic = "force-dynamic";

const EMPLOYMENT_LABEL: Record<string, string> = {
  in_house: "In-house",
  contractor: "Contractor",
  ai_tutor: "AI tutor",
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await loadTeacherDetail(id);
  if (!teacher) notFound();

  const primaries = teacher.assignedStudents.filter((s) => s.role === "primary");
  const specialists = teacher.assignedStudents.filter(
    (s) => s.role === "specialist"
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/teachers"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to teachers
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-navy">{teacher.fullName}</h1>
            <p className="mt-1 font-mono text-xs text-mute">{teacher.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cream bg-mist/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy">
              {EMPLOYMENT_LABEL[teacher.employmentType] ?? teacher.employmentType}
            </span>
            <span className="rounded-full border border-cream bg-mist/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-navy">
              {teacher.status}
            </span>
          </div>
        </div>
      </div>

      {teacher.bio && (
        <section className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            About
          </p>
          <p className="text-sm text-ink">{teacher.bio}</p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Departments
          </p>
          {teacher.departments.length === 0 ? (
            <p className="text-sm text-mute">Not assigned to a department.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {teacher.departments.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  {d.isHead && (
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
                      Head
                    </span>
                  )}
                  <span className="text-ink">{d.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-cream bg-paper p-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            ClassIn
          </p>
          {teacher.classinAccountId ? (
            <p className="font-mono text-sm text-ink">
              {teacher.classinAccountId}
            </p>
          ) : (
            <p className="text-sm text-mute">
              No ClassIn account — AI tutor or async-only coach.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-navy">Assigned students</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
            {teacher.studentCount} active
          </p>
        </div>
        {teacher.studentCount === 0 ? (
          <p className="text-sm text-mute">No students currently assigned.</p>
        ) : (
          <>
            {primaries.length > 0 && (
              <AssignmentList title="Primary" items={primaries} />
            )}
            {specialists.length > 0 && (
              <AssignmentList title="Specialist" items={specialists} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function AssignmentList({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    name: string | null;
    email: string | null;
    assignedAt: string;
  }[];
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">
        {title} ({items.length})
      </p>
      <ul className="flex flex-col divide-y divide-cream">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {s.name?.trim() || s.email || "Unnamed"}
              </p>
              {s.name && s.email && (
                <p className="font-mono text-[10px] text-mute">{s.email}</p>
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
    </div>
  );
}
