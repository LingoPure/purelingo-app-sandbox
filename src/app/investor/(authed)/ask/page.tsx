import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInvestor } from "@/lib/investor/auth";
import {
  INVESTOR_MORGAN_AGENT_ID,
  loadVoiceRecall,
  buildWelcomeBackMessage,
  buildMorganSessionPrompt,
} from "@/lib/investor/voice-morgan";
import { AskMode } from "./ask-mode";

export const metadata: Metadata = {
  title: "Ask · LingoPure Investor Dataroom",
};

export default async function InvestorAskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const investor = user ? await loadInvestor(user.id) : null;
  const scope =
    investor?.maxTier === "restricted"
      ? "the full dataroom, including the deep-dive board materials"
      : "the main dataroom";

  // Voice Morgan recall — computed server-side from prior calls. The welcome-back
  // is the opener; the session prompt carries what she remembers (thesis /
  // concerns / follow-ups) so she picks up naturally mid-call, not just in the
  // greeting. Degrade-don't-fake: no agent / no history → fresh, base greeting.
  let welcomeBack: string | null = null;
  let sessionPrompt: string | null = null;
  let returning = false;
  if (user && investor && INVESTOR_MORGAN_AGENT_ID) {
    const recall = await loadVoiceRecall(createAdminClient(), user.id);
    welcomeBack = buildWelcomeBackMessage(recall);
    sessionPrompt = buildMorganSessionPrompt(recall);
    returning = recall.hasHistory;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">
          Ask the dataroom
        </h1>
        <p className="max-w-prose text-base text-navy/70">
          Ask any question about LingoPure and get a specific, cited answer drawn
          from {scope} — instead of reading through every file. Every answer
          quotes the source documents it used; if something isn&apos;t in the
          dataroom, the analyst tells you rather than guessing. Prefer to talk it
          through first? Morgan, the voice guide, helps you work out what to ask.
        </p>
      </header>
      <AskMode
        voiceAgentId={INVESTOR_MORGAN_AGENT_ID}
        userId={user?.id ?? ""}
        welcomeBack={welcomeBack}
        sessionPrompt={sessionPrompt}
        returning={returning}
      />
    </div>
  );
}
