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
          Your improvement programme
        </h1>
        <p className="max-w-prose text-sm text-slate-600 sm:text-base">
          {plan.firstName}, here&apos;s how you did, what it means for your role
          as {plan.role}, and the programme we propose to close the gap.
        </p>
      </header>

      {/* Voice delivery + commitment */}
      <section aria-label="Talk through your programme" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Sit down with Aria
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600">
          Aria will walk you through your results, the rationale behind each
          area, and get your commitment to the programme.
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
              {" · "}You are: <span className="font-bold text-emerald-700">{plan.currentLevel}</span>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {plan.skills.map((skill) => (
              <div key={skill.skill} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800">{skill.label}</span>
                  <span className="text-slate-500">
                    {skill.score != null ? `${skill.score}/1000` : "—"}
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                  role="progressbar"
                  aria-valuenow={skill.score ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={1000}
                >
                  <div
                    className={`h-full rounded-full ${
                      skill.gap > 200
                        ? "bg-rose-500"
                        : skill.gap > 100
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(100, ((skill.score ?? 0) / 1000) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Gap vs role baseline: {skill.gap}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programme phases */}
      <section aria-label="Programme" className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          16-week programme
        </h2>
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

      {/* Commitment statement */}
      <section
        aria-label="Commitment"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6"
      >
        <h2 className="font-semibold text-emerald-900">Your commitment</h2>
        <p className="mt-2 max-w-prose text-sm text-emerald-800">
          {plan.commitmentStatement}
        </p>
      </section>
    </div>
  );
}