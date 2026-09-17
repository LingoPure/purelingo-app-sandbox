import "server-only";

import { defineDiscovery } from "@caistech/discovery-agent";
import { createClient } from "@supabase/supabase-js";
import { ariaDiscoveryConfig } from "./aria-discovery-config";

/**
 * Wire the client-safe Aria persona config to the server-side runtime deps
 * (voice provision hooks, the Supabase service-role sink, runner).
 *
 * SERVER-ONLY: imports this file must never reach a client bundle —
 * `SUPABASE_SERVICE_ROLE_KEY` is read here at module scope. Client components
 * import ariaDiscoveryConfig from aria-discovery-config.ts instead.
 */

export const ariaDiscovery = defineDiscovery(
  ariaDiscoveryConfig,
  {
    runner: {
      run: async ({ schema }) => {
        // Placeholder runner
        return {
          result: schema.parse({
            role_suitability: "Suitable",
            communication_style: "Professional",
            language_goals: ["Fluency"],
            confidence_score: 8,
          }),
        };
      },
    },
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    existingAgentId: process.env.ELEVENLABS_AGENT_ID || undefined,
    sessionSecret: process.env.DISCOVERY_SESSION_SECRET || "temp-secret",
    supabase: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ),
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://purelingo-app-sandbox.vercel.app",
  }
);