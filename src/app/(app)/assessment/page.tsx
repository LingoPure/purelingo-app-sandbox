// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_BANK_V1 } from "@/lib/2k/question-bank";
import { AssessmentRunner } from "./assessment-runner";

export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/assessment");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          CEFR Speaking Assessment
        </p>
        <h1 className="font-serif text-3xl text-navy">
          25-question intelligence journey
        </h1>
      </div>
      <AssessmentRunner questions={QUESTION_BANK_V1} />
    </div>
  );
}
