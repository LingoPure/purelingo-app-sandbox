import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve the plan-delivery voice agent (the SEPARATE ElevenLabs agent used
 * for plan chats, distinct from the discovery agent).
 *
 * Resolution order:
 *   1. ELEVENLABS_PLAN_AGENT_ID env var (canonical, written by the provision
 *      script)
 *   2. The seeded convai_agents row for agent_name = 'LingoPure Plan Agent'.
 *      convai_agents is RLS-scoped to the owning app user, so this MUST go
 *      through the service-role (admin) client — a student's client can never
 *      resolve it.
 *
 * Used by:
 *   - /api/plan/delivery (GET - returns agentId alongside the compiled plan)
 *   - /api/plan/session (POST - mints the voice session for it)
 */
export async function resolvePlanAgentId(): Promise<string | undefined> {
  const fromEnv = process.env.ELEVENLABS_PLAN_AGENT_ID;
  if (fromEnv) return fromEnv;

  const admin = createAdminClient();
  const { data } = await admin
    .from("convai_agents")
    .select("elevenlabs_agent_id")
    .eq("agent_name", "LingoPure Plan Agent")
    .eq("status", "active")
    .maybeSingle();
  return (data as { elevenlabs_agent_id?: string } | null)?.elevenlabs_agent_id;
}