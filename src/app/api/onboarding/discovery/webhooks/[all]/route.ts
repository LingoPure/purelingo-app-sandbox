import { ariaDiscovery } from "@/lib/onboarding/aria-discovery";
import { CONVAI_TOOL_SECRET_HEADER } from "@caistech/elevenlabs-convai";

// The discovery-agent provides all routes via webhookRoutes()
const routes = ariaDiscovery.webhookRoutes();

// Map the catch-all [all] slug to the corresponding route handler.
//
// SECURITY — memory-loop endpoints (recall/save/topic) are unauthenticated at the
// library level (identity derives from the public agent id). When CONVAI_TOOL_SECRET
// is set we guard here: ONLY requests carrying the matching `x-convai-tool-secret`
// header (baked into provisioned agents' tools) pass. The post-call route is exempt —
// it is independently HMAC-verified via the post-call webhook secret.
const TOOL_SECRET = process.env.CONVAI_TOOL_SECRET || undefined;

function guard(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (TOOL_SECRET && req.headers.get(CONVAI_TOOL_SECRET_HEADER) !== TOOL_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    return handler(req);
  };
}

export const POST = async (
  req: Request,
  ctx: { params: Promise<{ all: string }> }
) => {
  const { all } = await ctx.params;
  const slug = all.split("/").pop();

  switch (slug) {
    case "postCall":
      return routes.postCall(req);
    case "saveMessage":
      return guard(routes.saveMessage)(req);
    case "recallMemory":
      return guard(routes.recallMemory)(req);
    case "saveMemory":
      return guard(routes.saveMemory)(req);
    case "updateTopic":
      return guard(routes.updateTopic)(req);
    default:
      return new Response("Not Found", { status: 404 });
  }
};