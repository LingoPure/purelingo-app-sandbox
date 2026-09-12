import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import { loadTeacherStudents } from "@/lib/teacher/portal-data";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) redirect("/dashboard?error=not_teacher");

  const students = await loadTeacherStudents(supabase, teacher.teacherId);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">My Students - {teacher.fullName}</h1>
      <div className="mt-6 grid gap-4">
        {students.map((s) => (
          <Link key={s.studentId} href={`/teacher/students/${s.studentId}`} className="block rounded-lg border p-4 hover:bg-mist">
            <h2 className="font-semibold">{s.name}</h2>
            <p className="text-sm text-mute">Latest Score: {s.latestScore ?? "No assessment"}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
