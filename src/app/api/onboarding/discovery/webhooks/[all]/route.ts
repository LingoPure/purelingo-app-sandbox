import { createConvaiWebhookRoutes } from "@caistech/elevenlabs-convai";
import { createClient } from "@supabase/supabase-js";

// Canonical memory-loop tool routes for the shared discovery agent.
//
// Identity model (VOICE_MEMORY_STANDARD rule 9): the conversation→user binding
// is established server-side at connect via /api/convai/bind (writes
// convai_voice_bindings). start_conversation resolves identity from that table;
// recall/save resolve from the convai_conversations row written by start.
// The client never asserts a bare user_id.

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

const routes = createConvaiWebhookRoutes({
  supabase: adminSupabase(),
  requireToolSecret: true,

  // Identity for start_conversation: look up the server-trusted bind at connect time.
  resolveSession: async (_req, body) => {
    const conversationId = String(body.elevenlabs_conversation_id || "");
    if (!conversationId) return null;
    const sb = adminSupabase();
    const { data } = await sb
      .from("convai_voice_bindings")
      .select("user_id")
      .eq("elevenlabs_conversation_id", conversationId)
      .maybeSingle();
    return data ? { userId: data.user_id } : null;
  },
});

// Map the catch-all [all] slug to the corresponding route handler.
//
// SECURITY — memory-loop endpoints (recall/save/topic) require the
// x-convai-tool-secret header (baked into provisioned agents' tools) via
// requireToolSecret: true on the routes above. The post-call route is bound
// to /api/convai/webhook (not here) and independently HMAC-verified.
//
// NOTE — tool URLs from createConversationTools use snake_case slugs
// (save_message, recall_memory, etc.), NOT camelCase.

export const POST = async (
  req: Request,
  ctx: { params: Promise<{ all: string }> }
) => {
  const { all } = await ctx.params;
  const slug = all.split("/").pop();

  switch (slug) {
    case "start_conversation":
      return routes.startConversation(req);
    case "save_message":
      return routes.saveMessage(req);
    case "recall_memory":
      return routes.recallMemory(req);
    case "save_memory":
      return routes.saveMemory(req);
    case "update_topic":
      return routes.updateTopic(req);
    default:
      return new Response("Not Found", { status: 404 });
  }
};
