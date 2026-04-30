import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DiscoverySession } from "./discovery-session";

const DIMENSIONS = [
  { num: "1", label: "Language capability", body: "Speaking, listening, reading, intent comprehension." },
  { num: "2", label: "Role & seniority", body: "Job title, department, decision-making level." },
  { num: "3", label: "Responsibilities", body: "Daily tasks requiring English; reporting lines." },
  { num: "4", label: "Interaction audit", body: "Email, calls, meetings, presentations, reports." },
  { num: "5", label: "Target level", body: "Employer requirement or career target." },
  { num: "6", label: "Learning style", body: "Feedback preference, session length, time available." },
];

export default async function OnboardingPage() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  // Pull the authenticated student's id + name. Layout already gates auth.
  let userId: string | null = null;
  let studentName: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      studentName =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        null;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          Phase 0 — Discovery session
        </p>
        <h1 className="font-serif text-3xl text-navy">
          A 20–35 minute conversation, not a test
        </h1>
        <p className="mt-3 max-w-2xl text-mute">
          Our voice AI walks you through six dimensions to build your initial gap
          profile. Speak naturally — there are no wrong answers, only data we use
          to personalise everything that comes next.
        </p>
      </div>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">What we cover</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {DIMENSIONS.map((d) => (
            <div key={d.num} className="flex gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy font-mono text-xs text-paper">
                {d.num}
              </span>
              <div>
                <h3 className="font-medium text-ink">{d.label}</h3>
                <p className="text-sm text-mute">{d.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-cream bg-paper p-8 text-center">
        {agentId && userId ? (
          <>
            <h2 className="mb-2 font-serif text-2xl text-navy">Ready when you are</h2>
            <p className="mb-6 text-sm text-mute">
              Plug in your headset, find a quiet spot, and click below to start.
              The conversation runs in your browser.
            </p>
            <DiscoverySession
              agentId={agentId}
              userId={userId}
              studentName={studentName}
            />
          </>
        ) : (
          <>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-gold">
              Discovery agent — not yet configured
            </p>
            <h2 className="mb-2 font-serif text-2xl text-navy">
              Awaiting ElevenLabs ConvAI agent
            </h2>
            <p className="mx-auto mb-1 max-w-lg text-sm text-mute">
              Run{" "}
              <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
                npx tsx scripts/provision-discovery-agent.ts
              </code>{" "}
              to create the agent, paste{" "}
              <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
                ELEVENLABS_AGENT_ID
              </code>{" "}
              and{" "}
              <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
                ELEVENLABS_WEBHOOK_SECRET
              </code>{" "}
              into{" "}
              <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-xs">
                .env.local
              </code>
              , then redeploy.
            </p>
            <p className="mt-6">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-navy hover:underline"
              >
                ← Back to dashboard
              </Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
