"use client";

import { useState } from "react";
import { AskChat } from "./ask-chat";
import { InvestorVoiceMorgan } from "./investor-voice-morgan";

type Mode = "choose" | "text" | "voice";

/**
 * The conscious choice at the top of "Ask the dataroom":
 *   - "Text only — I know what I need"  → the cited written analyst (AskChat).
 *   - "Talk to Morgan — help me figure it out" → the voice clarifier.
 *
 * Both are first-class and one tap apart; the text Ask is retained unchanged.
 */
export function AskMode({
  voiceAgentId,
  userId,
  welcomeBack,
  sessionPrompt,
  returning,
}: {
  voiceAgentId: string;
  userId: string;
  welcomeBack: string | null;
  sessionPrompt: string | null;
  returning: boolean;
}) {
  const [mode, setMode] = useState<Mode>("choose");

  if (mode === "text") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setMode("voice")}
          className="min-h-[44px] text-sm font-medium text-navy/60 hover:text-navy"
        >
          ← Prefer to talk it through? Switch to Morgan
        </button>
        <AskChat />
      </div>
    );
  }

  if (mode === "voice") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setMode("text")}
          className="min-h-[44px] text-sm font-medium text-navy/60 hover:text-navy"
        >
          ← I know what I need — switch to the text Ask
        </button>
        <InvestorVoiceMorgan
          agentId={voiceAgentId}
          userId={userId}
          welcomeBack={welcomeBack}
          sessionPrompt={sessionPrompt}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setMode("text")}
        className="flex flex-col gap-2 rounded-2xl border border-cream bg-paper p-5 text-left transition hover:border-gold hover:bg-gold/5 sm:p-6"
      >
        <span className="font-serif text-lg text-navy">Text only</span>
        <span className="text-sm font-medium text-navy/70">
          I know what I need
        </span>
        <span className="text-sm text-navy/60">
          Type your question and get a specific, source-cited answer drawn
          straight from the dataroom.
        </span>
      </button>

      <button
        type="button"
        onClick={() => setMode("voice")}
        className="flex flex-col gap-2 rounded-2xl border border-cream bg-paper p-5 text-left transition hover:border-gold hover:bg-gold/5 sm:p-6"
      >
        <span className="flex items-center gap-2 font-serif text-lg text-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/female_avatar.jpeg"
            alt=""
            aria-hidden
            className="h-7 w-7 rounded-full object-cover"
          />
          Talk to Morgan
        </span>
        <span className="text-sm font-medium text-navy/70">
          {returning ? "Welcome back — pick up where you left off" : "Help me figure out what I need"}
        </span>
        <span className="text-sm text-navy/60">
          Have a conversation to get clarity on what you&apos;re evaluating, then
          turn it into the right cited answers — one tap away.
        </span>
      </button>
    </div>
  );
}
