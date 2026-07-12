import { agentManifestHandler } from "@caistech/webmcp-kit";
import { agentConfig } from "@/agent-readiness.config";

export const GET = agentManifestHandler(agentConfig);
export const dynamic = "force-static";
