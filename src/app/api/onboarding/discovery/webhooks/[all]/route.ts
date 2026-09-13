import { ariaDiscovery } from "@/lib/onboarding/aria-discovery";

// The discovery-agent provides all routes via webhookRoutes()
const routes = ariaDiscovery.webhookRoutes();

// Map the catch-all [...all] slug to the corresponding route handler
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
      return routes.saveMessage(req);
    case "recallMemory":
      return routes.recallMemory(req);
    case "saveMemory":
      return routes.saveMemory(req);
    case "updateTopic":
      return routes.updateTopic(req);
    default:
      return new Response("Not Found", { status: 404 });
  }
};