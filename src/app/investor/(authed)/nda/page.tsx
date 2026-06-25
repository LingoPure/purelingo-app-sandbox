import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadInvestor } from "@/lib/investor/auth";
import { NDA_TEXT, NDA_VERSION } from "@/lib/investor/nda-text";
import { NdaAccept } from "./nda-accept";

export const metadata: Metadata = {
  title: "Deep-dive NDA · LingoPure Investor Dataroom",
};

export default async function NdaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const investor = user ? await loadInvestor(user.id) : null;
  const accepted = investor?.maxTier === "restricted" && Boolean(investor?.ndaAcceptedAt);
  const invited = Boolean(investor?.deepDiveInvited);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-2xl text-navy sm:text-3xl">
          Deep-dive access — NDA
        </h1>
        <p className="max-w-prose text-base text-navy/70">
          The deep-dive board materials (financial doctrine, cost summaries, the
          governance stack) are confidential. Read and accept the LingoPure NDA
          below to unlock them across the dataroom and reports. Your acceptance is
          recorded with your name and a timestamp.
        </p>
      </header>

      {accepted ? (
        <div className="rounded-2xl border border-teal/30 bg-teal/10 p-4 text-base text-navy">
          You&apos;ve accepted the NDA — deep-dive access is unlocked.{" "}
          <Link href="/investor/ask" className="font-medium text-navy underline">
            Ask the dataroom →
          </Link>
        </div>
      ) : !invited ? (
        <div className="rounded-2xl border border-cream bg-paper p-4 text-base text-navy/80">
          Deep-dive access hasn&apos;t been enabled for your account. You have full
          access to the main dataroom via{" "}
          <Link href="/investor/ask" className="font-medium text-navy underline">
            Ask
          </Link>{" "}
          and{" "}
          <Link href="/investor/documents" className="font-medium text-navy underline">
            Documents
          </Link>
          . If you believe you should have deep-dive access, contact LingoPure.
        </div>
      ) : (
        <>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-cream bg-paper p-4 text-sm leading-relaxed text-navy/80">
            {NDA_TEXT}
          </div>
          <NdaAccept version={NDA_VERSION} />
        </>
      )}
    </div>
  );
}
