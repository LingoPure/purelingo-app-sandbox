/**
 * Role-discovery session scoring — the finalizer step.
 *
 * Called from the convai webhook's role-discovery branch after a voice
 * interview between Aria and an employer admin wraps. Reuses the schema +
 * finalizer prompt already written for the (never-wired) text-chat version
 * of this flow (src/lib/employer/role-discovery/schema.ts) rather than
 * duplicating them — the finalizer's job (transcript in, structured role
 * profile out) is identical whether the transcript came from chat turns or
 * a voice call.
 *
 * Inputs : role_id + the interview transcript
 * Outputs: roles.description/profile_json updated + 6 rows in
 *          public.role_baselines (one per skill), upserted by (role_id, skill).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANTHROPIC_MODEL,
  anthropicClient,
  parseStructuredFull,
} from "@/lib/llm/client";
import { SKILL_KEYS } from "@/lib/scoring/rubric";
import {
  RoleDiscoveryProfileSchema,
  ROLE_DISCOVERY_FINALIZER_PROMPT,
  type RoleDiscoveryProfile,
} from "@/lib/employer/role-discovery/schema";

export type RoleDiscoveryTranscriptTurn = {
  role: "agent" | "user";
  message: string;
};

export type ScoreRoleDiscoveryInput = {
  roleId: string;
  conversationId: string;
  transcript: RoleDiscoveryTranscriptTurn[];
};

export type ScoreRoleDiscoveryResult = {
  profile: RoleDiscoveryProfile;
};

function client() {
  return anthropicClient();
}

export async function scoreRoleDiscoverySession(
  supabase: SupabaseClient,
  input: ScoreRoleDiscoveryInput
): Promise<ScoreRoleDiscoveryResult> {
  if (!input.transcript.length) {
    throw new Error("Cannot finalize an empty role-interview transcript");
  }

  const anthropic = client();

  // The finalizer prompt was written for "assistant"/"user" chat turns; a
  // voice transcript uses "agent"/"user" — map once here so the schema and
  // prompt stay exactly as already written rather than forking a second copy.
  const userMessage = JSON.stringify(
    input.transcript.map((t) => ({
      role: t.role === "agent" ? "assistant" : "user",
      content: t.message,
    }))
  );

  const { output: profile } = await parseStructuredFull(
    anthropic,
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: [
        {
          type: "text",
          text: ROLE_DISCOVERY_FINALIZER_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Here is the role-interview transcript. Produce the role profile now.\n\n${userMessage}`,
        },
      ],
    },
    RoleDiscoveryProfileSchema
  );

  // roles: description + the rich structured extras. name is deliberately
  // NOT overwritten here — the admin already named the role when starting
  // the interview, and silently renaming it out from under them on finalize
  // would be a surprising, unrequested change.
  const { error: roleErr } = await supabase
    .from("roles")
    .update({
      description: profile.description,
      defined_via: "voice_interview",
      profile_json: {
        responsibilities: profile.responsibilities,
        vocabulary_domain: profile.vocabulary_domain,
        notes_for_lesson_planner: profile.notes_for_lesson_planner,
        skill_rationale: Object.fromEntries(
          SKILL_KEYS.map((skill) => [skill, profile.skills[skill].rationale])
        ),
        skill_examples: Object.fromEntries(
          SKILL_KEYS.map((skill) => [skill, profile.skills[skill].examples])
        ),
      },
    })
    .eq("id", input.roleId);
  if (roleErr) {
    console.error("[score-role-discovery] roles update failed:", roleErr.message);
  }

  // role_baselines: one upsert per skill, PK (role_id, skill) so this is
  // idempotent on retry (same posture as the student discovery scorer's
  // setCanonicalGapScores).
  const { error: baselineErr } = await supabase.from("role_baselines").upsert(
    SKILL_KEYS.map((skill) => ({
      role_id: input.roleId,
      skill,
      min_score: profile.skills[skill].baseline,
      notes: profile.skills[skill].rationale,
    })),
    { onConflict: "role_id,skill" }
  );
  if (baselineErr) {
    console.error("[score-role-discovery] role_baselines upsert failed:", baselineErr.message);
  }

  return { profile };
}
