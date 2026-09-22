// @explanatory-header-exempt — assessment result page; header intent is obvious from content
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPlan } from "@/lib/plan/plan-delivery";
import { PlanDelivery } from "./plan-delivery";

/**
 * /plan — the improvement programme presentation.
 *
 * After the assessment battery (discovery + email sprint + speak & score),
 * this page sits down with the student: the on-screen summary shows their
 * scores vs the role baseline, and the voice agent (Aria) walks them through
 * the rationale and asks for commitment. The same data drives both.
 *
 * Client voice session: POST /api/plan/session → token + compiled prompt.
 */

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const plan = await buildPlan(supabase, user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Your sample programme
        </h1>
        <p className="max-w-prose text-sm text-slate-600 sm:text-base">
          {plan.firstName}, here&apos;s how you did, what it means for your role
          as {plan.role}, and what a personalised programme could look like to
          close the gap. This is a free preview — nothing here has been booked.
        </p>
      </header>

      {/* Voice delivery */}
      <section aria-label="Talk through your programme" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Sit down with Aria
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Aria will walk you through your results and the rationale behind
          each area, and show you what this sample programme could look like.
        </p>
        <div className="mt-4">
          <PlanDelivery />
        </div>
      </section>

      {/* On-screen summary */}
      <section aria-label="Score summary" className="space-y-6">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Your scores</h2>
            <span className="text-sm font-medium text-slate-500">
              Target: <span className="font-bold text-slate-900">{plan.targetLevel}</span>
              {" · "}You are:{" "}
              <span className="font-bold text-emerald-700">
                {plan.currentLevel}
                {plan.currentLp18 && ` (${plan.currentLp18})`}
              </span>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.skills.map((skill) => (
              <div key={skill.skill} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{skill.label}</span>
                  <span className="text-slate-500">
                    {skill.assessed
                      ? `${skill.score}/1000${skill.lp18Band ? ` · ${skill.lp18Band}` : ""}`
                      : "—"}
                  </span>
                </div>
                {skill.assessed ? (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuenow={skill.score!}
                    aria-valuemin={0}
                    aria-valuemax={1000}
                  >
                    <div
                      className={`h-full rounded-full ${
                        skill.roleFloorGap! > 200
                          ? "bg-rose-500"
                          : skill.roleFloorGap! > 100
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (skill.score! / 1000) * 100)}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.slate.200),theme(colors.slate.200)_4px,theme(colors.slate.50)_4px,theme(colors.slate.50)_8px)]"
                    role="img"
                    aria-label={`${skill.label}: not yet assessed`}
                  />
                )}
                {skill.assessed ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Gap vs role baseline: {skill.roleFloorGap} · Gap vs target ({plan.targetLevel}):{" "}
                    {skill.targetGap}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Not yet assessed</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supporting signals — secondary measures, not part of the CEFR band */}
      <section aria-label="Supporting signals" className="space-y-6">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Supporting signals</h2>
            <p className="text-sm text-slate-500">
              Secondary measures — they inform your programme but aren&apos;t part of your CEFR band above.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.supportingSkills.map((skill) => (
              <div key={skill.skill} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{skill.label}</span>
                  <span className="text-slate-500">
                    {skill.assessed
                      ? `${skill.score}/1000${skill.lp18Band ? ` · ${skill.lp18Band}` : ""}`
                      : "—"}
                  </span>
                </div>
                {skill.assessed ? (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuenow={skill.score!}
                    aria-valuemin={0}
                    aria-valuemax={1000}
                  >
                    <div
                      className={`h-full rounded-full ${
                        skill.roleFloorGap! > 200
                          ? "bg-rose-500"
                          : skill.roleFloorGap! > 100
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (skill.score! / 1000) * 100)}%`,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-[repeating-linear-gradient(45deg,theme(colors.slate.200),theme(colors.slate.200)_4px,theme(colors.slate.50)_4px,theme(colors.slate.50)_8px)]"
                    role="img"
                    aria-label={`${skill.label}: not yet assessed`}
                  />
                )}
                {skill.assessed ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Gap vs role baseline: {skill.roleFloorGap} · Gap vs target ({plan.targetLevel}):{" "}
                    {skill.targetGap}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Not yet assessed</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programme phases */}
      <section aria-label="Programme" className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Sample {plan.totalWeeks}-week programme
        </h2>
        {plan.currentLevel === "N/A" && (
          <p className="max-w-prose rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You haven&apos;t completed your assessment yet, so this is a generic
            sample based on typical requirements for your role — not scores of
            your own. Finish the assessment to see a programme personalised to
            your results.
          </p>
        )}
        {plan.phases.map((phase, idx) => (
          <div
            key={phase.name}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {idx + 1}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{phase.name}</h3>
                <p className="text-sm text-slate-500">{phase.weeks}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {phase.activities.map((activity) => (
                <li
                  key={`${phase.name}-${activity.type}`}
                  className="flex flex-wrap items-center gap-2 text-sm text-slate-700"
                >
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {activity.type}
                  </span>
                  <span>{activity.frequency}</span>
                  {activity.skill !== "varies" && activity.skill !== "all" && (
                    <span className="text-xs text-slate-400">· {activity.skill}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-prose text-sm text-slate-600">
              {phase.rationale}
            </p>
          </div>
        ))}
      </section>

      {/* Next step */}
      <section
        aria-label="Next step"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6"
      >
        <h2 className="font-semibold text-emerald-900">Your next step</h2>
        <p className="mt-2 max-w-prose text-sm text-emerald-800">
          {plan.nextStepStatement}
        </p>
        <a
          href="/book-a-demo"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Book a call
        </a>
      </section>
    </div>
  );
}