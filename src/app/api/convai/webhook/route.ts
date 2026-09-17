import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  parsePostCallPayload,
  handlePostCallWebhook,
  distillConversationToMemory,
  verifyAnonSessionToken,
  type TableNames,
} from "@caistech/elevenlabs-convai";
import { createClient } from "@supabase/supabase-js";
import { scoreDiscoverySession } from "@/lib/scoring/score-discovery";
import { awardXp } from "@/lib/gamification/award";
import { ariaMemoryExtractor } from "@/lib/onboarding/aria-memory";
import {
  INVESTOR_MORGAN_AGENT_ID,
  morganMemoryExtractor,
} from "@/lib/investor/voice-morgan";

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

type PostCallPayload = NonNullable<ReturnType<typeof parsePostCallPayload>>;

/**
 * Investor Morgan post-call: persist the call into convai_* keyed by the
 * SERVER-TRUSTED investor (from investor_voice_sessions, written at connect by
 * the authed bind route), then distil it to convai_memory for next-time recall.
 * The client-supplied user_id dynamic variable is only a fallback; the binding
 * wins so a tampered client can't write into another investor's memory.
 */
async function handleInvestorMorganPostCall(payload: PostCallPayload) {
  const supabase = adminSupabase();
  const conversationId = payload.data.conversation_id;

  const { data: binding } = await supabase
    .from("investor_voice_sessions")
    .select("investor_id")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle();
  const fallbackUserId =
    payload.data.conversation_initiation_client_data?.dynamic_variables?.user_id;
  const investorId = binding?.investor_id ?? fallbackUserId;

  if (!investorId) {
    console.warn(
      "[convai/webhook:morgan] no investor binding or user_id — ignoring",
      conversationId
    );
    return NextResponse.json({ ok: true, ignored: "no_investor" });
  }

  const startMs = payload.data.metadata.start_time_unix_secs * 1000;
  const endMs =
    (payload.data.metadata.end_time_unix_secs ??
      payload.data.metadata.start_time_unix_secs +
        payload.data.metadata.call_duration_secs) * 1000;
  const messages = payload.data.transcript.map((t) => ({
    role: (t.role === "agent" ? "assistant" : "user") as "user" | "assistant",
    content: t.message,
    timestamp: new Date(startMs + t.time_in_call_secs * 1000).toISOString(),
  }));

  const result = await handlePostCallWebhook(
    supabase,
    {
      elevenlabsAgentId: payload.data.agent_id,
      conversationId,
      userId: investorId,
      topic:
        payload.data.analysis?.transcript_summary?.slice(0, 80) ??
        "Investor dataroom call",
      status: payload.data.status === "done" ? "completed" : "abandoned",
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSecs: payload.data.metadata.call_duration_secs,
      terminationReason: payload.data.metadata.termination_reason,
      summary: payload.data.analysis?.transcript_summary,
      messages,
    },
    TABLES,
    // Distil ONCE, after the core conversation/message writes commit. Failures
    // here are logged inside the package and never roll back the transcript.
    async (conversation, sb) => {
      await distillConversationToMemory(sb, {
        elevenlabsConversationId: conversation.elevenlabsConversationId,
        conversationId: conversation.id,
        extract: morganMemoryExtractor(),
        tables: TABLES,
      });
    }
  );

  if (!result.success) {
    console.warn("[convai/webhook:morgan] persist skipped:", {
      error: result.error,
      conversationId,
      investorId,
    });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("elevenlabs-signature");
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;

  // Stay subscribed: ElevenLabs auto-disables a webhook that returns 4xx
  // (we got bitten by this once — a single 400 silently muted the whole
  // pipeline). For everything except a true configuration failure we now
  // log + return 200, so the subscription survives transient or
  // unexpected payload shapes. Real 5xx errors below get retried by
  // ElevenLabs; the 200-with-log path makes parsing/data issues visible
  // in Vercel logs without breaking subsequent deliveries.
  if (!secret) {
    return NextResponse.json(
      { error: "ELEVENLABS_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    // Genuine auth failure — keep 401 so a misconfigured forwarder
    // (wrong secret) gets noticed quickly. A real ElevenLabs delivery
    // never lands here.
    console.error("[convai/webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ReturnType<typeof parsePostCallPayload>;
  try {
    payload = parsePostCallPayload(rawBody);
  } catch (err) {
    // Don't 400 — log and acknowledge. A future ElevenLabs payload shape
    // change is otherwise an outage we won't see until students complain.
    console.error(
      "[convai/webhook] parsePostCallPayload threw — ignoring:",
      err instanceof Error ? err.message : err,
      "raw body prefix:",
      rawBody.slice(0, 400)
    );
    return NextResponse.json({ ok: true, ignored: "parse_error" });
  }
  if (!payload) {
    console.warn(
      "[convai/webhook] non-post-call event — ignoring. raw body prefix:",
      rawBody.slice(0, 400)
    );
    return NextResponse.json({ ok: true, ignored: "non_post_call" });
  }

  // Investor Morgan shares this workspace webhook (one bound URL). Route her
  // calls to the investor memory path and return — the discovery scoring below
  // does not apply to her.
  if (
    INVESTOR_MORGAN_AGENT_ID &&
    payload.data.agent_id === INVESTOR_MORGAN_AGENT_ID
  ) {
    return handleInvestorMorganPostCall(payload);
  }

  const conversationId = payload.data.conversation_id;

  // Identity is SERVER-derived, never client-asserted (VOICE_MEMORY_STANDARD
  // rule 9). The bind table (written at connect by /api/convai/bind from the
  // authenticated session) wins; fall back to verifying the discovery session
  // token minted by startSession() — the discovery widget passes it as the
  // user_id dynamic variable, but we VERIFY it here rather than trusting a
  // bare client string. A tampered client hitting neither path is ignored.
  let userId: string | null = null;
  const svc = adminSupabase();
  const { data: binding } = await svc
    .from("convai_voice_bindings")
    .select("user_id")
    .eq("elevenlabs_conversation_id", conversationId)
    .maybeSingle();
  if (binding?.user_id) {
    userId = binding.user_id;
  } else {
    const token =
      payload.data.conversation_initiation_client_data?.dynamic_variables?.user_id;
    if (token) {
      const sessionSecret = process.env.DISCOVERY_SESSION_SECRET;
      if (sessionSecret) {
        const claims = verifyAnonSessionToken(sessionSecret, token);
        if (claims?.sid) userId = claims.sid;
      }
    }
  }

  if (!userId) {
    console.warn(
      "[convai/webhook] no server-derived identity — ignoring conversation",
      conversationId
    );
    return NextResponse.json({ ok: true, ignored: "missing_identity" });
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
    TABLES,
    // The distill leg of the persistent-memory loop: after the conversation +
    // messages commit, distil the interview into convai_memory so a returning
    // learner is remembered next session (cross logout/login — keyed to the
    // server-trusted user_id, not a browser token). Runs once per finished
    // conversation (processed_at gate inside handlePostCallWebhook).
    async ({ userId: distillUserId, id: convaiConversationId }) => {
      const { saved, error } = await distillConversationToMemory(supabase, {
        elevenlabsConversationId: payload.data.conversation_id,
        conversationId: convaiConversationId,
        extract: ariaMemoryExtractor(),
        tables: TABLES,
      });
      if (error) {
        console.warn(`[convai/webhook] discovery distill skipped for ${distillUserId}:`, error);
      } else {
        console.log(
          `[convai/webhook] discovery distill saved ${saved} memory item(s) for ${distillUserId}`
        );
      }
    }
  );

  if (!result.success) {
    // handlePostCallWebhook may skip persistence when there is no convai_agents
    // row for this agent (e.g. not yet seeded by the provision script). That is
    // NOT a failure of discovery — scoring below works directly off the
    // transcript. Log and continue so scoring still runs.
    console.warn("[convai/webhook] convai persist skipped, continuing to scoring:", {
      error: result.error,
      agentId: payload.data.agent_id,
      conversationId: payload.data.conversation_id,
      userId,
      messageCount: messages.length,
    });
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
