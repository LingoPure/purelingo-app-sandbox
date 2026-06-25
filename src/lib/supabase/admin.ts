import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS). SERVER-ONLY — never import this
 * into a client component.
 *
 * Use it only after the caller's identity/authorisation has already been
 * established (e.g. by requireInvestor), to read RLS-protected rows the user's
 * own client cannot — the dataroom chunks/documents and the match_dataroom_chunks
 * RPC are granted to service_role only — and to write audit rows.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
