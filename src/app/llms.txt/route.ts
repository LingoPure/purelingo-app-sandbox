import { llmsTxtHandler } from "@caistech/webmcp-kit";
import { agentConfig } from "@/agent-readiness.config";

export const GET = llmsTxtHandler(agentConfig);
export const dynamic = "force-static";
