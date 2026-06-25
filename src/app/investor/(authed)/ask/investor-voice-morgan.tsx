"use client";

import { VoiceWidget } from "@caistech/elevenlabs-convai/react";

/**
 * Voice Morgan — the investor dataroom voice clarifier. Wraps the canonical
 * portfolio VoiceWidget (avatar-on-top + transcript + Begin), so this is the
 * same Morgan surface used everywhere else, not a per-product re-implementation.
 *
 * - avatar: /female_avatar.jpeg (the standard portfolio coach face)
 * - identity: userId → user_id dynamic var; onConnect binds the conversation to
 *   the authed investor server-side (memory labelling can't be spoofed).
 * - memory: welcome-back greeting injected as a first-message override (recall),
 *   call distilled to convai_memory by the post-call webhook (persist).
 * - degrade-don't-fake: textFallback shows a type box if voice can't run.
 */
export function InvestorVoiceMorgan({
  agentId,
  userId,
  welcomeBack,
}: {
  agentId: string;
  userId: string;
  welcomeBack: string | null;
}) {
  if (!agentId) {
    return (
      <div className="rounded-2xl border border-cream bg-paper p-4 text-base text-navy/70 sm:p-6">
        Morgan, the voice guide, isn&apos;t available right now — use the text
        Ask instead; it gives the same cited answers.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cream bg-paper p-4 sm:p-6">
      <VoiceWidget
        agentId={agentId}
        userId={userId}
        placement="fullpage"
        mode="discovery"
        transcript
        textFallback
        avatarUrl="/female_avatar.jpeg"
        coachName="Morgan"
        title="Talk it through with Morgan. Tell her, in your own words, what you're evaluating — she helps you turn a broad interest into the specific questions the dataroom can answer, then you get a cited written answer in one tap."
        overrides={
          welcomeBack ? { agent: { firstMessage: welcomeBack } } : undefined
        }
        onConnect={(conversationId) => {
          // Server-trusted binding so the post-call webhook labels this call's
          // memory against THIS investor (never the client dynamic var).
          fetch("/api/investor/voice/bind", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ conversationId }),
          }).catch(() => {});
        }}
      />
    </div>
  );
}
