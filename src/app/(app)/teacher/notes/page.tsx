import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import { loadTeacherStudents } from "@/lib/teacher/portal-data";
import { loadTeacherNotes } from "@/lib/teacher/notes";
import { TeacherNotesComposer } from "@/components/teacher/notes-composer";

export const metadata = { title: "Notes · LingoPure" };

export default async function TeacherNotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) redirect("/dashboard?error=not_a_teacher");

  const [students, notes] = await Promise.all([
    loadTeacherStudents(supabase, teacher.teacherId),
    loadTeacherNotes(supabase),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-navy">Notes</h1>
      <p className="mt-1 text-sm text-mute">
        Observations that stay with each student, visible to them and your org.
      </p>

      <div className="mt-6">
        <TeacherNotesComposer students={students} />
      </div>

      <h2 className="mt-10 font-serif text-xl text-navy">Recent notes</h2>
      <ul className="mt-3 space-y-2">
        {notes.length === 0 && (
          <li className="rounded-lg border border-line bg-white p-4 text-sm text-mute">
            No notes yet — add one above.
          </li>
        )}
        {notes.map((n) => (
          <li
            key={n.id}
            className="rounded-lg border border-line bg-white p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/teacher/students/${n.student_id}`}
                className="text-sm font-semibold text-navy hover:underline"
              >
                {n.student_name ?? "Student"}
              </Link>
              <time className="shrink-0 text-xs text-mute">
                {new Date(n.created_at).toLocaleDateString()}
              </time>
            </div>
            <p className="mt-2 text-sm text-soft-mute">{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}