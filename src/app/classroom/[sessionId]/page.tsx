import Link from "next/link";

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const credsPresent = Boolean(
    process.env.CLASSIN_APP_ID && process.env.CLASSIN_APP_SECRET
  );

  if (!credsPresent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-gold">
          Session {sessionId}
        </p>
        <h1 className="mb-4 font-serif text-4xl text-paper">
          ClassIn integration pending
        </h1>
        <p className="mb-1 max-w-xl text-mute">
          Live classroom credentials must be obtained from EEO Technology before this
          embed can connect to a real ClassIn session.
        </p>
        <p className="mb-8 max-w-xl text-mute">
          Set <code className="rounded bg-paper/10 px-1.5 py-0.5 font-mono text-xs text-paper">CLASSIN_APP_ID</code> and{" "}
          <code className="rounded bg-paper/10 px-1.5 py-0.5 font-mono text-xs text-paper">CLASSIN_APP_SECRET</code> in{" "}
          <code className="rounded bg-paper/10 px-1.5 py-0.5 font-mono text-xs text-paper">.env.local</code> when
          available — this page renders the SDK iframe automatically.
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

  // TODO(build sequence step 3): generate ClassIn SSO token server-side using
  // CLASSIN_APP_ID + CLASSIN_APP_SECRET + student.classin_user_id + sessionId,
  // then render the SDK iframe with the token. See briefing §7.2.
  return (
    <iframe
      src={`/api/classin/embed?session=${encodeURIComponent(sessionId)}`}
      title={`ClassIn session ${sessionId}`}
      className="flex-1 border-0"
      allow="camera; microphone; display-capture; fullscreen"
    />
  );
}
