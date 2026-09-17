import "server-only";

import { defineDiscovery } from "@caistech/discovery-agent";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ariaDiscoveryConfig } from "./aria-discovery-config";

/**
 * Wire the client-safe Aria persona config to the server-side runtime deps
 * (voice provision hooks, the Supabase service-role sink, runner).
 *
 * SERVER-ONLY: imports this file must never reach a client bundle —
 * `SUPABASE_SERVICE_ROLE_KEY` is read here at module scope. Client components
 * import ariaDiscoveryConfig from aria-discovery-config.ts instead.
 */

/**
 * Module-scope `createClient("")` throws `supabaseUrl is required`, which
 * takes down any build whose environment lacks the Supabase keys. Builds
 * must never require runtime secrets, so the client is constructed only when
 * the env is present and relies lazily on it otherwise (null only materialises
 * into a clear 500 if the env-missing app is asked to serve a webhook).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase: SupabaseClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : (null as unknown as SupabaseClient);

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
    supabase,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://purelingo-app-sandbox.vercel.app",
  }
);