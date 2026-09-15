// @explanatory-header-exempt — portal home; the page heading is the explanatory header
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import {
  loadTeacherStudents,
  loadTeacherClasses,
  type ClassSession,
} from "@/lib/teacher/portal-data";
import { loadTeacherNotes } from "@/lib/teacher/notes";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/teacher");

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) redirect("/dashboard?error=not_teacher");

  const [students, classes, notes] = await Promise.all([
    loadTeacherStudents(supabase, teacher.teacherId),
    loadTeacherClasses(supabase, teacher.teacherId),
    loadTeacherNotes(supabase, 5),
  ]);

  const assessments = students.reduce((sum, s) => sum + s.assessments, 0);
  const upcoming = classes.filter(
    (c) => c.status === "scheduled" || c.status === "live"
  );
  const scorable = students.filter((s) => s.latestScore !== null).length;
  const avgScore = scorable
    ? Math.round(
        students.reduce((sum, s) => sum + (s.latestScore ?? 0), 0) / scorable
      )
    : null;

  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">My Students</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        {teacher.fullName}&apos;s roster — {students.length} assigned learner(s), their
        latest LP1000 result, and upcoming ClassIn sessions.
      </p>

      <div className="mb-8 mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={students.length} />
        <StatCard label="Assessments" value={assessments} />
        <StatCard label="Upcoming classes" value={upcoming.length} />
        <StatCard label="Avg LP1000" value={avgScore ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-serif text-xl text-navy">Roster</h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-mist/50">
                  <Th>Student</Th>
                  <Th>Role</Th>
                  <Th>Assessments</Th>
                  <Th>Latest LP1000</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.map((s) => (
                  <tr key={s.studentId} className="hover:bg-mist/40">
                    <Td>
                      <Link
                        href={`/teacher/students/${s.studentId}`}
                        className="font-medium text-navy hover:text-teal"
                      >
                        {s.name}
                      </Link>
                    </Td>
                    <Td>
                      <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                        {s.assignmentRole}
                      </span>
                    </Td>
                    <Td className="text-mute">{s.assessments}</Td>
                    <Td>
                      {s.latestScore !== null ? (
                        <>
                          <span className="font-semibold text-ink">{s.latestScore}</span>
                          <span className="ml-1 text-xs text-mute">{s.latestBand}</span>
                        </>
                      ) : (
                        <span className="text-mute">No assessment</span>
                      )}
                    </Td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-mute">
                      No assigned students yet — they appear once an org allocates you
                      learners.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl text-navy">Upcoming classes</h2>
            <span className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
              {upcoming.length}
            </span>
          </div>
          <ul className="space-y-2">
            {upcoming.length === 0 && (
              <li className="rounded-xl border border-line bg-white p-4 text-sm text-mute">
                No scheduled classes yet.
              </li>
            )}
            {upcoming.map((c) => <ClassCard key={c.scheduleId} c={c} />)}
          </ul>
        </div>
      </div>

      <h2 className="mb-3 mt-10 font-serif text-xl text-navy">Recent notes</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-line bg-white p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{n.student_name ?? "Student"}</span>
              <span className="text-xs text-mute">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-mute">{n.body}</p>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="rounded-xl border border-line bg-white p-4 text-sm text-mute">
            No notes yet — add one from the Notes page.
          </p>
        )}
      </div>
    </div>
  );
}

function ClassCard({ c }: { c: ClassSession }) {
  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-medium text-ink">{c.studentName ?? "Student"}</p>
      {c.scheduledAt && (
        <p className="mt-0.5 text-xs text-mute">
          {new Date(c.scheduledAt).toLocaleString()}
        </p>
      )}
      <span className="mt-2 inline-block rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
        {c.status}
      </span>
      {c.recordingUrl && (
        <a
          href={c.recordingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-xs font-medium text-teal hover:underline"
        >
          View recording →
        </a>
      )}
    </li>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-mute">{label}</p>
      <p className="mt-1 font-serif text-3xl text-navy">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}