import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve the AI voice-tutor agent — a THIRD separate ElevenLabs agent,
 * distinct from discovery (assessment) and the plan-delivery agent
 * (consultant), so drill sessions never flow into either of those pipelines.
 *
 * Same resolution order as resolve-plan-agent.ts:
 *   1. ELEVENLABS_VOICE_TUTOR_AGENT_ID env var (written by the provision script)
 *   2. The seeded convai_agents row for agent_name = 'LingoPure Voice Tutor Agent'.
 */
export async function resolveVoiceTutorAgentId(): Promise<string | undefined> {
  const fromEnv = process.env.ELEVENLABS_VOICE_TUTOR_AGENT_ID;
  if (fromEnv) return fromEnv;

  const admin = createAdminClient();
  const { data } = await admin
    .from("convai_agents")
    .select("elevenlabs_agent_id")
    .eq("agent_name", "LingoPure Voice Tutor Agent")
    .eq("status", "active")
    .maybeSingle();
  return (data as { elevenlabs_agent_id?: string } | null)?.elevenlabs_agent_id;
}
