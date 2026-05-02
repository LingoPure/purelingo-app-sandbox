/**
 * Server-side conversation-token proxy for ElevenLabs ConvAI.
 *
 * Two transports, chosen via `?transport=websocket|webrtc`:
 *
 *   - websocket (DEFAULT) — fetches a signed WSS URL and returns
 *     `{ signedUrl }`. Single TLS connection on 443; survives every
 *     corporate / hotel / mobile network we've tested. Slightly higher
 *     latency than WebRTC (~150ms), inaudible to non-technical users.
 *
 *   - webrtc — fetches a WebRTC conversation token (LiveKit JWT) and
 *     returns `{ token }`. Lower latency, but requires UDP / STUN / TURN
 *     which corporate firewalls and CGNAT setups frequently block.
 *     Available behind `?transport=webrtc` for testing only.
 *
 * The client always asks for websocket. The previous WebRTC-primary +
 * fallback dance produced a race that intermittently disabled the
 * Pause / End buttons (see discovery-session.tsx commit history).
 *
 * Auth: must be a signed-in student. The agent ID is server-side env, so a
 * leaked client can't request a token for a different agent.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Transport = "webrtc" | "websocket";

export async function GET(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: "ElevenLabs env not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const transportParam = new URL(request.url).searchParams.get("transport");
  // Websocket is now the default (and what the discovery client always
  // requests). WebRTC remains opt-in via `?transport=webrtc` for testing.
  const transport: Transport =
    transportParam === "webrtc" ? "webrtc" : "websocket";

  const upstreamPath =
    transport === "websocket"
      ? "/v1/convai/conversation/get_signed_url"
      : "/v1/convai/conversation/token";
  const url = `https://api.elevenlabs.io${upstreamPath}?agent_id=${encodeURIComponent(
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
    console.error(`[convai/token:${transport}] fetch failed: ${detail}`);
    return NextResponse.json(
      { error: `ElevenLabs unreachable: ${detail}` },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(
      `[convai/token:${transport}] ElevenLabs ${response.status}: ${text.slice(
        0,
        300
      )}`
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
    | { token?: string; signed_url?: string }
    | null;

  if (transport === "websocket") {
    const signedUrl = body?.signed_url;
    if (!signedUrl) {
      console.error(
        `[convai/token:websocket] missing signed_url field: ${JSON.stringify(
          body
        ).slice(0, 300)}`
      );
      return NextResponse.json(
        { error: "ElevenLabs returned no signed_url" },
        { status: 502 }
      );
    }
    console.log(
      `[convai/token:websocket] issued signed URL for ${user.id} (agent ${agentId.slice(
        -8
      )})`
    );
    return NextResponse.json({ signedUrl });
  }

  const token = body?.token;
  if (!token) {
    console.error(
      `[convai/token:webrtc] missing token field: ${JSON.stringify(body).slice(
        0,
        300
      )}`
    );
    return NextResponse.json(
      { error: "ElevenLabs returned no token" },
      { status: 502 }
    );
  }

  console.log(
    `[convai/token:webrtc] issued token for ${user.id} (agent ${agentId.slice(
      -8
    )})`
  );
  return NextResponse.json({ token });
}
