import "server-only";

import { defineDiscovery } from "@caistech/discovery-agent";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { roleDiscoveryConfig } from "./role-discovery-config";

/**
 * Wire the client-safe role-interview persona config to server-side
 * runtime deps. Mirrors onboarding/aria-discovery.ts exactly — SERVER-ONLY,
 * must never reach a client bundle.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase: SupabaseClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : (null as unknown as SupabaseClient);

export const roleDiscovery = defineDiscovery(
  roleDiscoveryConfig,
  {
    runner: {
      run: async ({ schema }) => {
        // Placeholder runner — real extraction happens server-side from the
        // transcript (score-role-discovery.ts), not via this package's own
        // distil loop. Same posture as onboarding/aria-discovery.ts.
        return {
          result: schema.parse({ interview_complete: true }),
        };
      },
    },
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    existingAgentId: process.env.ELEVENLABS_ROLE_DISCOVERY_AGENT_ID || undefined,
    sessionSecret: process.env.DISCOVERY_SESSION_SECRET || "temp-secret",
    supabase,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://purelingo-app-sandbox.vercel.app",
  }
);
