import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor } from "@/lib/investor/auth";
import { AskChat } from "./ask-chat";

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
          dataroom, the analyst tells you rather than guessing.
        </p>
      </header>
      <AskChat />
    </div>
  );
}
