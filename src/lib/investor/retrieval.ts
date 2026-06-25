/**
 * Tier-filtered RAG retrieval over the investor dataroom.
 *
 * The chunks table + the match_dataroom_chunks RPC are RLS-protected and
 * EXECUTE-granted to service_role only, so retrieval always runs through the
 * service-role client AFTER the route has resolved the caller's allowed tiers.
 * The tier filter lives inside the SECURITY DEFINER RPC — passing the wrong
 * tiers here can only ever narrow, never widen, what a caller is entitled to,
 * and the route derives the tiers from the server-side investor row.
 *
 * Reused by the Q&A agent (Phase 2) and the report generator (Phase 4).
 */

import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/investor/auth";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
const EMBEDDING_DIMS = 1536; // must match the vector(1536) column in migration 0020

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  displayName: string;
  page: number | null;
  content: string;
  isVisionCaption: boolean;
  tier: Tier;
  similarity: number;
};

type RpcRow = {
  chunk_id: string;
  document_id: string;
  display_name: string;
  page: number | null;
  content: string;
  is_vision_caption: boolean;
  confidentiality_tier: Tier;
  similarity: number;
};

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const openai = new OpenAI({ apiKey });
  const r = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMS,
  });
  return r.data[0].embedding;
}

export async function retrieveChunks(
  query: string,
  allowedTiers: Tier[],
  matchCount = 12
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);
  const svc = createAdminClient();
  const { data, error } = await svc.rpc("match_dataroom_chunks", {
    query_embedding: embedding,
    allowed_tiers: allowedTiers,
    match_count: matchCount,
  });
  if (error) throw new Error(`retrieval failed: ${error.message}`);
  const rows = (data ?? []) as RpcRow[];
  return rows.map((r) => ({
    chunkId: r.chunk_id,
    documentId: r.document_id,
    displayName: r.display_name,
    page: r.page,
    content: r.content,
    isVisionCaption: r.is_vision_caption,
    tier: r.confidentiality_tier,
    similarity: r.similarity,
  }));
}
