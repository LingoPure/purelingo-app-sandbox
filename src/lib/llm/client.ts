/**
 * LingoPure — shared LLM client layer.
 *
 * One construction site for the Anthropic SDK so the whole app can be pointed
 * at any Anthropic-wire-compatible gateway (LiteLLM, OpenRouter, a free-model
 * bridge, etc.) with two env vars:
 *
 *   ANTHROPIC_BASE_URL   gateway root that speaks /v1/messages (default: real Anthropic)
 *   ANTHROPIC_MODEL      model name the gateway maps (default: claude-sonnet-4-6)
 *   ANTHROPIC_FAST_MODEL high-volume model (default: claude-haiku-4-5-20251001)
 *
 * When unset the behavior is identical to before — real Anthropic, same
 * models — so production is untouched until the env vars are present.
 *
 * Structured output: `parseStructured` prefers Anthropic `messages.parse` +
 * `zodOutputFormat`, and falls back to a plain `messages.create` + JSON-text
 * parse for gateways that reject `output_config`. The fallback strips
 * `cache_control` blocks (strict free-model bridges reject them).
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z, type ZodType } from "zod";

export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export const ANTHROPIC_FAST_MODEL =
  process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5-20251001";

let _client: Anthropic | null = null;

/** Single shared client. Honors ANTHROPIC_BASE_URL when set. */
export function anthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });
  }
  return _client;
}

/** Fail-fast key guard with the same message the old per-file guards used. */
export function anthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return apiKey;
}

export type StructuredParams = Omit<
  Anthropic.MessageCreateParams,
  "output_config"
> & { max_tokens: number };

function textOf(message: Anthropic.Message): string {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

/** Pull the first JSON object out of a possibly-fenced LLM text reply. */
export function extractJsonText(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced) return fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function stripCacheControls(
  params: StructuredParams
): StructuredParams {
  const system = params.system;
  if (Array.isArray(system)) {
    return {
      ...params,
      system: system.map((block) => {
        if (typeof block === "object" && "cache_control" in block) {
          const { cache_control: _dropped, ...rest } = block;
          return rest;
        }
        return block;
      }),
    };
  }
  return params;
}

/**
 * Append a strict-JSON directive + the zod-derived JSON schema to the last
 * user message. This is what makes free models (which ignore `output_config`)
 * conform to the target shape.
 */
function injectSchema(
  params: StructuredParams,
  schema: ZodType
): StructuredParams {
  const schemaText = JSON.stringify(z.toJSONSchema(schema, { reused: "ref" }));
  const instruction =
    `\n\nRespond with ONLY a single valid JSON object matching EXACTLY this ` +
    `JSON Schema. No commentary, no markdown fences, no extra fields:\n${schemaText}`;

  const messages = params.messages.map((message) => ({ ...message }));
  const last = messages[messages.length - 1];
  if (typeof last.content === "string") {
    last.content = last.content + instruction;
  } else if (Array.isArray(last.content)) {
    last.content = [...last.content, { type: "text", text: instruction }];
  }
  return { ...params, messages };
}

export type StructuredResult<Z extends ZodType> = {
  output: Z["_output"];
  usage: Anthropic.Usage | null;
};

/**
 * Structured-output request that survives a free-model bridge.
 *
 * Real Anthropic path (no `ANTHROPIC_BASE_URL`): `messages.parse` +
 * `zodOutputFormat` — typed, cached, structured. If that endpoint rejects
 * `output_config` (or returns unparseable text), falls back.
 *
 * Bridge path (`ANTHROPIC_BASE_URL` set): skips `output_config` outright —
 * free-model gateways ignore it — and goes straight to a plain
 * `messages.create` with the JSON schema injected into the prompt, then
 * parses the JSON out of the reply.
 */
export async function parseStructuredFull<Z extends ZodType>(
  client: Anthropic,
  baseParams: StructuredParams,
  schema: Z
): Promise<StructuredResult<Z>> {
  const isBridge = Boolean(process.env.ANTHROPIC_BASE_URL);

  if (!isBridge) {
    try {
      const response = await client.messages.parse({
        ...baseParams,
        stream: false,
        output_config: { format: zodOutputFormat(schema) },
      });
      if (response.parsed_output) {
        return { output: response.parsed_output as Z["_output"], usage: response.usage ?? null };
      }
    } catch {
      // Native structured output unsupported or failed for this endpoint —
      // fall through to the schema-injected create below.
    }
  }

  const response = await client.messages.create({
    ...stripCacheControls(injectSchema(baseParams, schema)),
    stream: false,
  });
  const text = extractJsonText(textOf(response));
  try {
    return {
      output: schema.parse(JSON.parse(text)) as Z["_output"],
      usage: response.usage ?? null,
    };
  } catch (parseErr) {
    throw new Error(
      `parseStructured fallback failed (${String(parseErr).slice(0, 120)}): ${text.slice(0, 400)}`
    );
  }
}

/** Convenience wrapper — output only, for callers that don't audit usage. */
export async function parseStructured<Z extends ZodType>(
  client: Anthropic,
  baseParams: StructuredParams,
  schema: Z
): Promise<Z["_output"]> {
  const { output } = await parseStructuredFull(client, baseParams, schema);
  return output;
}