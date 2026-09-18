// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bilingualize, type Bilingual } from "@/lib/i18n/translate";
import { resolveNativeLanguage } from "@/lib/i18n/native-language";
import { PostCallStatus } from "./post-call-status";

/**
 * Post-call transition — shown the moment the learner ends the voice session.
 *
 * Explains the three-step self-assessment in English + the learner's native
 * language (translateBatch falls back to English when unavailable), then polls
 * /api/onboarding/discovery/status until the post-call webhook has flipped
 * discovery_status to 'complete' (and scored the session). Only then does it
 * hand the learner to /onboarding/battery — which gates on that same flag, so
 * a blind redirect here is what used to bounce learners back into a fresh
 * voice call (the "what do I do now?" loop).
 */

const EN = {
  kickerWait: "That's the conversation done",
  kickerDone: "Profile compiled",
  titleWait: "Here's what happens next",
  titleDone: "Your profile is ready",
  intro:
    "Your discovery call is the first step of a self-assessment. These three steps build the same profile your employer sees — we'll walk you through each one.",
  step1t: "Your voice profile compiles",
  step1d:
    "Aria's notes on your fluency, comprehension and learning style are being scored and written to your profile.",
  step2t: "A short written assessment",
  step2d:
    "Four quick tasks — email writing, listen & paraphrase, read & summarise, and vocabulary — measure the skills a voice call can't.",
  step3t: "Micro-lessons keep scoring your baseline",
  step3d:
    "Email sprints and speak-and-score drills update your profile every time you do one — it's the same baseline your employer sees.",
};

export default async function PostCallPage() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: studentRaw } = await supabase
    .from("students")
    .select("name, discovery_status")
    .eq("id", user.id)
    .maybeSingle();
  const studentRow = (studentRaw ?? null) as {
    name?: string | null;
    discovery_status?: string | null;
  } | null;

  const name =
    studentRow?.name?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    null;

  const nativeLang = await resolveNativeLanguage();
  const [bKWait, bKDone, bTWait, bTDone, bIntro, bS1t, bS1d, bS2t, bS2d, bS3t, bS3d] =
    await bilingualize(
      [
        EN.kickerWait,
        EN.kickerDone,
        EN.titleWait,
        EN.titleDone,
        EN.intro,
        EN.step1t,
        EN.step1d,
        EN.step2t,
        EN.step2d,
        EN.step3t,
        EN.step3d,
      ],
      nativeLang
    );

  const copy = {
    kickerWait: bKWait as Bilingual,
    kickerDone: bKDone as Bilingual,
    titleWait: bTWait as Bilingual,
    titleDone: bTDone as Bilingual,
    intro: bIntro as Bilingual,
    steps: [
      { title: bS1t as Bilingual, desc: bS1d as Bilingual },
      { title: bS2t as Bilingual, desc: bS2d as Bilingual },
      { title: bS3t as Bilingual, desc: bS3d as Bilingual },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl py-6">
      <PostCallStatus
        name={name}
        initiallyComplete={studentRow?.discovery_status === "complete"}
        copy={copy}
      />
    </div>
  );
}