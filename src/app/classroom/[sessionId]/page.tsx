// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readClassinCredentials } from "@/lib/classin/token";
import { buildEmbedUrl } from "@/lib/classin/embed";
import { ClassroomFrame } from "./classroom-frame";

type SessionRow = {
  id: string;
  classin_class_id: string;
  teacher_name: string | null;
  scheduled_at: string | null;
  status: string | null;
};

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/classroom/${sessionId}`);

  // RLS scopes this to student_id = auth.uid() — we don't need an extra
  // ownership check.
  const { data: session } = await supabase
    .from("classin_sessions")
    .select("id, classin_class_id, teacher_name, scheduled_at, status")
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();

  if (!session) return <NotFoundShell sessionId={sessionId} />;

  const { data: student } = await supabase
    .from("students")
    .select("classin_user_id")
    .eq("id", user.id)
    .maybeSingle();

  // No EEO credentials yet — show a structural placeholder. Don't mock the
  // ClassIn UI (briefing §10 risk register).
  const creds = readClassinCredentials();
  if (!creds) {
    return (
      <PendingShell
        sessionId={session.id}
        teacherName={session.teacher_name}
        scheduledAt={session.scheduled_at}
      />
    );
  }

  // No classin_user_id on file means this student has not yet been linked
  // to ClassIn LTI identity. Real flow: provision on first login.
  const classinUserId = student?.classin_user_id ?? `lp-${user.id.slice(0, 12)}`;

  const embedUrl = buildEmbedUrl(creds, {
    classinUserId,
    classinClassId: session.classin_class_id,
  });

  return (
    <ClassroomFrame
      sessionId={session.id}
      embedUrl={embedUrl}
      teacherName={session.teacher_name}
    />
  );
}

function PendingShell({
  sessionId,
  teacherName,
  scheduledAt,
}: {
  sessionId: string;
  teacherName: string | null;
  scheduledAt: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-paper/20 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-paper/80">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Sandbox
      </span>
      <h1 className="mb-4 max-w-xl font-serif text-4xl text-paper">
        ClassIn isn&apos;t connected in the sandbox
      </h1>
      <p className="mb-2 max-w-xl text-base text-mute">
        {teacherName ? `Class with ${teacherName}` : "Your class"}
        {scheduledAt
          ? ` · ${new Date(scheduledAt).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : ""}
      </p>
      <p className="mb-8 max-w-xl text-base leading-relaxed text-mute">
        Live classes run on ClassIn, which isn&apos;t connected in this sandbox
        demo yet — it&apos;s wired up in the production build. Everything else in
        your learning flow works as normal.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-[44px] items-center rounded-md border border-paper/20 px-4 py-2.5 text-sm font-medium text-paper hover:bg-paper/10"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}

function NotFoundShell({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-coral">
        Not found
      </p>
      <h1 className="mb-4 font-serif text-3xl text-paper">
        No session matches that ID
      </h1>
      <p className="mb-8 max-w-xl text-mute">
        Session <code className="font-mono text-xs">{sessionId}</code> isn&apos;t scheduled
        for your account, or it has been cancelled.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md border border-paper/20 px-4 py-2 text-sm font-medium text-paper hover:bg-paper/10"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
