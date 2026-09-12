import { createClient } from "@/lib/supabase/server";
import { getTeacherIdentity } from "@/lib/teacher/auth";
import { loadStudentDetail } from "@/lib/teacher/portal-data";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TeacherStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const teacher = await getTeacherIdentity(supabase, user);
  if (!teacher) redirect("/dashboard?error=not_teacher");

  const detail = await loadStudentDetail(supabase, teacher.teacherId, studentId);
  if (!detail) redirect("/teacher?error=student_not_found");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{detail.name}</h1>
      <p className="text-sm text-mute">Target: {detail.targetLevel} · {detail.employerName ?? "—"}</p>

      <div className="mt-6 flex gap-4">
        <Link href={`/teacher/students/${studentId}/report`} className="rounded bg-navy px-4 py-2 text-white hover:bg-navy-deep">
          View Master Brain Report
        </Link>
        <Link href="/teacher" className="rounded border px-4 py-2 hover:bg-mist">
          ← Back to Students
        </Link>
      </div>

      <pre className="mt-8 text-xs">{JSON.stringify(detail, null, 2)}</pre>
    </div>
  );
}
