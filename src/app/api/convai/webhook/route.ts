import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  parsePostCallPayload,
  handlePostCallWebhook,
  type TableNames,
} from "@caistech/elevenlabs-convai";
import { createClient } from "@supabase/supabase-js";
import { scoreDiscoverySession } from "@/lib/scoring/score-discovery";
import { awardXp } from "@/lib/gamification/award";

// Map the package's generic table-name interface onto our public.convai_* schema.
const TABLES: TableNames = {
  agents: "convai_agents",
  conversations: "convai_conversations",
  messages: "convai_messages",
  memory: "convai_memory",
};

function adminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env not configured (URL + SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("elevenlabs-signature");
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "ELEVENLABS_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ReturnType<typeof parsePostCallPayload>;
  try {
    payload = parsePostCallPayload(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!payload) {
    return NextResponse.json(
      { error: "Payload was not a post-call event" },
      { status: 400 }
    );
  }

  const userId =
    payload.data.conversation_initiation_client_data?.dynamic_variables?.user_id;
  if (!userId) {
    return NextResponse.json(
      { error: "Missing user_id in conversation dynamic_variables" },
      { status: 400 }
    );
  }

  const supabase = adminSupabase();
  const startMs = payload.data.metadata.start_time_unix_secs * 1000;
  const endMs =
    (payload.data.metadata.end_time_unix_secs ??
      payload.data.metadata.start_time_unix_secs +
        payload.data.metadata.call_duration_secs) * 1000;

  // 1. Persist into convai_conversations / convai_messages via the package's helper.
  const messages = payload.data.transcript.map((t) => ({
    role: (t.role === "agent" ? "assistant" : "user") as "user" | "assistant",
    content: t.message,
    timestamp: new Date(startMs + t.time_in_call_secs * 1000).toISOString(),
  }));

  const result = await handlePostCallWebhook(
    supabase,
    {
      elevenlabsAgentId: payload.data.agent_id,
      conversationId: payload.data.conversation_id,
      userId,
      topic:
        payload.data.analysis?.transcript_summary?.slice(0, 80) ??
        "Discovery session",
      status: payload.data.status === "done" ? "completed" : "abandoned",
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSecs: payload.data.metadata.call_duration_secs,
      terminationReason: payload.data.metadata.termination_reason,
      summary: payload.data.analysis?.transcript_summary,
      messages,
    },
    TABLES
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // 2. Mirror to LingoPure's domain table so /dashboard can show "discovery complete"
  //    and step 5 (gap scoring) has a single canonical row to operate on.
  const { error: discoveryErr } = await supabase
    .from("discovery_sessions")
    .upsert(
      {
        student_id: userId,
        convai_conversation_id: payload.data.conversation_id,
        transcript_json: payload.data.transcript,
        status: payload.data.status === "done" ? "complete" : "failed",
        completed_at: new Date(endMs).toISOString(),
      },
      { onConflict: "convai_conversation_id" }
    );

  if (discoveryErr) {
    console.error("[convai/webhook] discovery_sessions upsert failed:", discoveryErr);
  }

  // 3. Flip the student's discovery_status so the dashboard moves past the
  //    "complete your discovery session" gate.
  if (payload.data.status === "done") {
    await supabase
      .from("students")
      .update({ discovery_status: "complete" })
      .eq("id", userId);
  }

  // 4. Run gap-scoring (briefing build sequence #5). We call the lib directly
  //    rather than self-POSTing — saves a round-trip and keeps the service-role
  //    client in-process. Failures are logged but do NOT 5xx the webhook:
  //    ElevenLabs would retry the whole post-call payload, which would re-
  //    upsert the transcript pointlessly. /api/scoring/discovery is the
  //    manual retry path if scoring fails here.
  if (payload.data.status === "done") {
    try {
      const result = await scoreDiscoverySession(supabase, {
        studentId: userId,
        conversationId: payload.data.conversation_id,
        transcript: payload.data.transcript,
      });
      // Award gamification XP for completing the discovery session.
      await awardXp(userId, "discoveryComplete", supabase);
      console.log(
        `[convai/webhook] scored ${userId} — overall ${result.scores.overall_cefr}, ` +
          `target ${result.scores.target_level}, ` +
          `tokens in/out/cache_read/cache_write = ${result.inputTokens}/${result.outputTokens}/` +
          `${result.cacheReadTokens}/${result.cacheWriteTokens}`
      );
    } catch (err) {
      console.error(
        "[convai/webhook] gap scoring failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({ ok: true });
}
