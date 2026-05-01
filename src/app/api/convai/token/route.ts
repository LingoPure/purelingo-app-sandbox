/**
 * Server-side conversation-token proxy for ElevenLabs ConvAI.
 *
 * The browser SDK can either (a) hit ElevenLabs' /v1/convai/conversation/token
 * directly with `{ agentId }`, or (b) be handed a pre-fetched WebRTC token via
 * `{ conversationToken }`. We do (b) so:
 *
 *   1. The ElevenLabs API key never reaches the browser.
 *   2. We log every connection attempt — if the token fetch fails, we see
 *      WHY in our Vercel runtime logs instead of having to scrape headless
 *      browser console output.
 *   3. We avoid origin/CORS/cert-pinning issues that some networks have
 *      with api.elevenlabs.io.
 *
 * Auth: must be a signed-in student. We don't echo the agentId back from the
 * client — it's pulled from server env so a leaked client can't request a
 * token for a different agent.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "ElevenLabs env not configured" },
      { status: 500 }
    );
  }

  // Auth: only signed-in users can request a token.
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(
    agentId
  )}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "xi-api-key": apiKey },
      // Fail fast — the SDK already shows "connecting…" so a hang here
      // looks broken. 12s is generous for a single GET.
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[convai/token] fetch failed: ${detail}`);
    return NextResponse.json(
      { error: `ElevenLabs unreachable: ${detail}` },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(
      `[convai/token] ElevenLabs ${response.status}: ${text.slice(0, 300)}`
    );
    return NextResponse.json(
      {
        error: `ElevenLabs returned ${response.status}`,
        detail: text.slice(0, 500),
      },
      { status: response.status }
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { token?: string }
    | null;
  const token = body?.token;
  if (!token) {
    console.error(
      `[convai/token] missing token field in response: ${JSON.stringify(
        body
      ).slice(0, 300)}`
    );
    return NextResponse.json(
      { error: "ElevenLabs returned no token" },
      { status: 502 }
    );
  }

  console.log(
    `[convai/token] issued token for ${user.id} (agent ${agentId.slice(-8)})`
  );
  return NextResponse.json({ token });
}
