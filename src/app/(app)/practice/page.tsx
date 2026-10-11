import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SKILL_LABELS } from "@/lib/scoring/rubric";
import { VOICE_DRILLABLE_SKILLS, isDrillableSkill } from "@/lib/voice-tutor/drillable-skills";
import { VoiceTutorSession } from "./voice-tutor-session";

/**
 * On-demand AI voice-tutor practice — the "I need to practise X, right now"
 * entry point (as distinct from a curriculum-recommended session, reached
 * via the same page with ?skill=&source=plan from /dashboard's plan card).
 *
 * Explanatory header per PRODUCT_STANDARDS §5: what this is, what to do,
 * why it matters — short drill sessions for reinforcement, not assessment
 * and not a substitute for live tutoring on something new.
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; source?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/practice");

  const params = await searchParams;
  const requestedSkill = isDrillableSkill(params.skill) ? params.skill : null;
  const fromPlan = params.source === "plan";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          AI voice practice
        </p>
        <h1 className="font-serif text-3xl text-navy">
          {requestedSkill ? `Practice: ${SKILL_LABELS[requestedSkill]}` : "Quick practice with Aria"}
        </h1>
        <p className="mt-2 text-sm text-mute">
          A short, focused drill session — a few minutes of repetition on one skill. This
          reinforces something you&apos;ve already covered; it won&apos;t introduce anything new.
          For new material or personalised coaching, book a live class instead.
        </p>
      </div>

      {!requestedSkill && !fromPlan && (
        <SkillPicker currentSkill={requestedSkill} />
      )}

      <VoiceTutorSession
        requestedSkill={requestedSkill}
        trigger={fromPlan ? "scheduled" : "on_demand"}
      />
    </div>
  );
}

function SkillPicker({ currentSkill }: { currentSkill: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <p className="w-full text-xs font-mono uppercase tracking-[0.2em] text-mute">
        Pick a skill, or leave it to Aria to pick your biggest current gap
      </p>
      {VOICE_DRILLABLE_SKILLS.map((skill) => (
        <a
          key={skill}
          href={`/practice?skill=${skill}`}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            currentSkill === skill
              ? "border-navy bg-navy text-paper"
              : "border-navy/20 text-navy hover:bg-mist"
          }`}
        >
          {SKILL_LABELS[skill]}
        </a>
      ))}
    </div>
  );
}
