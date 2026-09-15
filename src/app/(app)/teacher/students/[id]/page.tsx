// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import {
  loadStudentDetail,
  loadStudentClasses,
} from "@/lib/teacher/portal-data";
import { loadTeacherNotes } from "@/lib/teacher/notes";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TeacherStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=" + encodeURIComponent(`/teacher/students/${studentId}`));

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) redirect("/dashboard?error=not_teacher");

  const [detail, classes, notes] = await Promise.all([
    loadStudentDetail(supabase, teacher.teacherId, studentId),
    loadStudentClasses(supabase, studentId),
    loadTeacherNotes(supabase, 50, studentId),
  ]);
  if (!detail) redirect("/teacher?error=student_not_found");

  const studentNotes = notes;

  return (
    <div>
      <Link
        href="/teacher"
        className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline"
      >
        ← My Students
      </Link>

      <h1 className="mt-2 font-serif text-3xl text-navy">{detail.name}</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">
        {detail.targetLevel ? `Target: ${detail.targetLevel}` : "No target level set"}
        {detail.employerName ? ` · ${detail.employerName}` : ""}
        {detail.assignmentRole ? ` · ${detail.assignmentRole}` : ""}
      </p>

      <div className="mb-8 mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Latest LP1000" value={detail.latestScore ?? "—"} />
        <StatCard label="Band" value={detail.latestBand ?? "No result yet"} />
        <StatCard label="Assessments" value={detail.assessments} />
        <StatCard label="Classes" value={classes.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-serif text-xl text-navy">Class history</h2>
            <Link
              href={`/teacher/students/${studentId}/report`}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-paper transition hover:bg-navy-deep"
            >
              View LP1000 report →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-mist/50">
                  <Th>When</Th>
                  <Th>Status</Th>
                  <Th>Duration</Th>
                  <Th>Recording</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {classes.map((c) => (
                  <tr key={c.scheduleId} className="hover:bg-mist/40">
                    <Td className="text-ink">
                      {c.scheduledAt
                        ? new Date(c.scheduledAt).toLocaleString()
                        : "—"}
                    </Td>
                    <Td>
                      <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-medium text-ink">
                        {c.status ?? "scheduled"}
                      </span>
                    </Td>
                    <Td className="text-mute">
                      {c.durationMins ? `${c.durationMins} min` : "—"}
                    </Td>
                    <Td>
                      {c.recordingUrl ? (
                        <a
                          href={c.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-teal hover:underline"
                        >
                          Watch →
                        </a>
                      ) : (
                        <span className="text-mute">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr>
                    <td className="py-8 text-center text-mute">
                      No ClassIn sessions for this learner yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-serif text-xl text-navy">Notes</h2>
          <ul className="space-y-2">
            {studentNotes.length === 0 && (
              <li className="rounded-xl border border-line bg-white p-4 text-sm text-mute">
                No notes for this student yet — add one from Notes.
              </li>
            )}
            {studentNotes.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-white p-4">
                <p className="text-xs text-mute">
                  {new Date(n.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 text-sm text-ink">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
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