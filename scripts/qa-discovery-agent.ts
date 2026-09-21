/**
 * Live agent QA — runs a REAL text-mode ConvAI conversation against the
 * deployed ElevenLabs discovery agent using a fictional Vietnamese B2B
 * student persona, then scores the transcript against the 6 dimensions from
 * briefing §07.1 and the protocol-enforcement rules from §09.
 *
 * Usage:
 *   npx tsx scripts/qa-discovery-agent.ts
 *
 * Env required: ELEVENLABS_AGENT_ID. Loaded from .env.local automatically.
 * (ELEVENLABS_API_KEY is not required for this path — the agent is public,
 * same as the browser widget, which also connects with a bare agentId.)
 *
 * HISTORY: this used to call ElevenLabs' single-shot
 * /v1/convai/agents/{id}/simulate-conversation REST endpoint. That endpoint
 * reliably fails on a realistic ~20-minute discovery conversation —
 * `SocketError: other side closed` / `UND_ERR_SOCKET`, connection killed
 * ~30-40s in with 0 bytes read, reproduced even with an unrelated dummy
 * persona (2026-09-21). A short/simple simulation on that same endpoint
 * completes fine in ~9s, so this looks like a timeout on ElevenLabs' side
 * (or a network hop) tied to how long the full simulation takes to generate,
 * not anything about this repo's prompt content.
 *
 * FIX: drive a real, turn-by-turn TEXT conversation instead of one giant
 * blocking call — each round-trip is fast, so there's nothing for a
 * long-request timeout to kill. Uses `@elevenlabs/client`'s `Conversation`
 * in `textOnly` mode over a websocket (the same connection type + package
 * the real app widget uses, just without audio). The persona's replies are
 * a fixed, ordered script rather than a second LLM role-playing the
 * student — good enough to smoke-test dimension coverage and the specific
 * ISS-053 regression (Aria re-asking role/responsibility after the student
 * already covered both), without adding another model dependency to a QA
 * script.
 */

import { Conversation, type TextConversation } from "@elevenlabs/client";

type TranscriptTurn = {
  role: "user" | "agent";
  message: string;
};

/**
 * Nguyen Thi Lan, 32, Senior Account Manager at Vinh Hoan Export Co. (Ho Chi
 * Minh City seafood exporter). B1+ English — fluent and confident but with
 * occasional Vietnamese-accented constructions and a weaker formal-writing
 * register. 4 years at the company, promoted 8 months ago; manages 12
 * international accounts across the US/UK/Australia; her boss wants her at
 * B2 within 6 months for a possible Australia relocation.
 *
 * Fixed, ordered script rather than an LLM role-playing her — sent one line
 * per Aria turn regardless of Aria's exact wording. That's a deliberate
 * simplification (a real student would react to what was actually asked),
 * but it's sufficient to smoke-test dimension coverage and the specific
 * regression this QA run exists to catch: turn 1 answers BOTH Dimension 1
 * (role) and Dimension 3 (responsibilities) together, which is exactly the
 * scenario Thao reported Aria re-asking from scratch (ISS-053).
 */
const LAN_TURNS: string[] = [
  "I'm the Senior Account Manager for our international accounts team — I've been in the role about eight months, four years at the company overall. Day to day I manage twelve client accounts across the US, UK and Australia: emails, calls, negotiating pricing, and a weekly report to regional management.",
  "I report directly to our regional director in Singapore. Maybe fifteen emails a week to clients, two or three calls, and one presentation a month that I always dread a little.",
  "Yes, go ahead.",
  "I think Sarah is hinting she wants to reopen the Q3 conversation, maybe get a better deal, without saying it directly.",
  "I'm aiming for B2 within six months — my manager wants me ready in case I move to the new Australia office.",
  "It's an employer requirement really, tied to the relocation.",
  "I like short sessions, maybe 15 to 25 minutes, usually in the evening after my kids are asleep. I'm pretty competitive, so I like seeing how I compare to others. My Vietnamese reading and writing is very strong.",
  "That's right.",
  "Yes, that covers everything I think.",
  "Sounds good, thank you.",
];
const LAN_FALLBACK =
  "I think I've covered that already, but happy to go into more detail if it helps.";

const MAX_AGENT_TURNS = 16;
const MAX_WALL_MS = 4 * 60 * 1000; // hard cap so a stuck connection can't hang the script forever

// Pre-call dynamic variables — must match what the runtime client passes
// in src/app/(app)/onboarding/discovery-session.tsx. ConvAI does not
// recurse when substituting variables, so we pre-interpolate the
// nested placeholders in first_message_localized here, exactly as the
// runtime does.
const QA_STUDENT = {
  user_id: "qa-fixture-user-id",
  student_name: "Nguyen Thi Lan",
  native_language: "Vietnamese",
  role_name: "Senior Account Manager",
  role_description:
    "Manages international client accounts, negotiates pricing, runs weekly reporting and presentations.",
  target_level: "B2",
  employer_name: "Vinh Hoan Export Co.",
};
const QA_FIRST_MESSAGE_TEMPLATE =
  "Hi {{student_name}}! I'm Aria from LingoPure. I've got the basics already — {{role_name}} at {{employer_name}}, aiming for {{target_level}}. We'll spend the next twenty or so minutes getting to know what's behind that — what your week actually looks like, where English shows up. No right or wrong answers. To start: walk me through what a typical day in your role looks like.";
const QA_DYNAMIC_VARIABLES: Record<string, string> = {
  ...QA_STUDENT,
  first_message_localized: QA_FIRST_MESSAGE_TEMPLATE.replaceAll(
    "{{student_name}}",
    QA_STUDENT.student_name
  )
    .replaceAll("{{role_name}}", QA_STUDENT.role_name)
    .replaceAll("{{employer_name}}", QA_STUDENT.employer_name)
    .replaceAll("{{target_level}}", QA_STUDENT.target_level)
    .replaceAll("{{native_language}}", QA_STUDENT.native_language),
};

/**
 * Drive a real text-mode ConvAI conversation turn by turn. Each agent
 * message triggers the next scripted Lan reply after a short pause (so it
 * doesn't look like a bot firing instantly); the session ends on
 * MAX_AGENT_TURNS, the wall-clock cap, or the agent disconnecting on its
 * own (its `end_call` tool, per the discovery-system-prompt closing phrase).
 */
async function runLiveConversation(agentId: string): Promise<TranscriptTurn[]> {
  const transcript: TranscriptTurn[] = [];
  let lanIdx = 0;
  let agentTurnCount = 0;
  let convo: TextConversation | null = null;
  let settled = false;

  await new Promise<void>((resolve, reject) => {
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallClock);
      fn();
    };

    const wallClock = setTimeout(() => {
      console.log("  (hit the 4-minute wall-clock cap — ending session)");
      settle(() => {
        convo?.endSession().finally(resolve).catch(resolve);
      });
    }, MAX_WALL_MS);

    Conversation.startSession({
      agentId,
      textOnly: true,
      connectionType: "websocket",
      dynamicVariables: QA_DYNAMIC_VARIABLES,
      onConnect: () => {
        console.log("  (connected)\n");
      },
      onMessage: (props) => {
        const role: "agent" | "user" = props.source === "ai" ? "agent" : "user";
        transcript.push({ role, message: props.message });
        console.log(`  [${role === "agent" ? "ARIA" : "LAN "}] ${props.message}`);

        if (role !== "agent") return;
        agentTurnCount++;
        if (agentTurnCount >= MAX_AGENT_TURNS) {
          settle(() => {
            convo?.endSession().finally(resolve).catch(resolve);
          });
          return;
        }
        const reply = LAN_TURNS[lanIdx] ?? LAN_FALLBACK;
        lanIdx++;
        setTimeout(() => convo?.sendUserMessage(reply), 500);
      },
      onDisconnect: (details) => {
        console.log(`  (disconnected: ${details.reason})`);
        settle(resolve);
      },
      onError: (message) => {
        console.error(`  (connection error: ${message})`);
      },
    })
      .then((c) => {
        convo = c;
      })
      .catch((err) => {
        settle(() => reject(err));
      });
  });

  return transcript;
}

// ── Heuristic dimension coverage scoring ─────────────────────────────────────
// Briefing §07.1 — agent must cover all 6 dimensions before ending.
type Dimension = {
  key: string;
  label: string;
  // Triggers — keywords that suggest the agent has explored this dimension.
  triggers: RegExp[];
};

const DIMENSIONS: Dimension[] = [
  {
    key: "language_capability",
    label: "Language capability (incl. reading-intent test)",
    triggers: [
      /paraphrase|interpret|read.*email|what.*asking|in your own words/i,
      /understand|comprehend|listen/i,
    ],
  },
  {
    key: "role_seniority",
    label: "Role & seniority",
    triggers: [
      /your (job|role|title|position)/i,
      /senior|junior|manager|director|head of|department/i,
      /how long.*(role|company|job)/i,
    ],
  },
  {
    key: "responsibilities",
    label: "Responsibilities",
    triggers: [
      /day.*look|typical (day|week)|day-to-day|daily|responsibilities|tasks/i,
      /report.*to|reporting line/i,
    ],
  },
  {
    key: "interaction_audit",
    label: "Interaction audit (email / calls / meetings / reports)",
    triggers: [
      /email/i,
      /call|phone|meeting|presentation|report/i,
      /how (often|many).*(email|call|meeting|week|month)/i,
    ],
  },
  {
    key: "target_level",
    label: "Target level",
    triggers: [
      /target|goal|level|cefr|B[12]\b|aim|by when|deadline/i,
      /employer.*(want|need|require)|company.*(want|need|require)/i,
    ],
  },
  {
    key: "learning_style",
    label: "Learning style & first-language literacy",
    triggers: [
      /learning style|prefer|short burst|deep dive|feedback/i,
      /vietnamese|first language|native language|read.*native|literacy/i,
      /time of day|when.*available|schedule/i,
    ],
  },
];

function scoreCoverage(transcript: TranscriptTurn[]) {
  const agentText = transcript
    .filter((t) => t.role === "agent")
    .map((t) => t.message)
    .join("\n")
    .toLowerCase();

  return DIMENSIONS.map((d) => {
    const hits = d.triggers.filter((re) => re.test(agentText)).length;
    return {
      ...d,
      hits,
      // Natural conversation may match only one trigger per dimension; that's fine.
      covered: hits >= 1,
    };
  });
}

// The reading-intent test is the highest-leverage QA signal — verify the
// literal email script appears in the agent's output.
function checkReadingTest(transcript: TranscriptTurn[]): boolean {
  const agentText = transcript
    .filter((t) => t.role === "agent")
    .map((t) => t.message)
    .join("\n");
  return /sarah/i.test(agentText) && /mark/i.test(agentText) && /(circle back|volume tier|q3 commitment)/i.test(agentText);
}

// ── Other QA checks ──────────────────────────────────────────────────────────
function checkEnglishOnly(transcript: TranscriptTurn[]) {
  const agentText = transcript
    .filter((t) => t.role === "agent")
    .map((t) => t.message)
    .join(" ");
  // Common Vietnamese diacritics — agent should not use any.
  const vnChars = /[ăâđêôơưĂÂĐÊÔƠƯạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/;
  return !vnChars.test(agentText);
}

function checkClosingPhrase(transcript: TranscriptTurn[]) {
  // Scan all agent turns — the wrap-up may fire mid-transcript when the
  // simulated user keeps saying "thanks, goodbye" past the natural end.
  return transcript
    .filter((t) => t.role === "agent")
    .some((t) =>
      /that's everything I needed.*gap profile.*ready.*welcome to lingopure/i.test(
        t.message
      )
    );
}

function turnCount(transcript: TranscriptTurn[]) {
  return {
    agent: transcript.filter((t) => t.role === "agent").length,
    user: transcript.filter((t) => t.role === "user").length,
    total: transcript.length,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    throw new Error("ELEVENLABS_AGENT_ID must be set in env");
  }

  console.log("\n▶ Running LIVE discovery session (text mode)...\n");
  console.log(`  Agent: ${agentId}`);
  console.log(`  Persona: Nguyen Thi Lan, B1+ Senior Account Manager (HCMC)\n`);

  const start = Date.now();
  const transcript = await runLiveConversation(agentId);
  const elapsedSecs = Math.round((Date.now() - start) / 1000);

  const counts = turnCount(transcript);
  const coverage = scoreCoverage(transcript);
  const englishOnly = checkEnglishOnly(transcript);
  const closing = checkClosingPhrase(transcript);
  const readingTest = checkReadingTest(transcript);

  const allCovered = coverage.every((d) => d.covered);
  const overall =
    allCovered && englishOnly && closing && readingTest ? "PASS" : "REVIEW";

  console.log(`\n◾ Session finished in ${elapsedSecs}s — ${counts.total} turns (${counts.agent} agent / ${counts.user} user)\n`);
  console.log(`◾ Verdict: ${overall}\n`);

  console.log("◾ Dimension coverage (≥1 trigger hit = covered):");
  for (const d of coverage) {
    const mark = d.covered ? "✓" : "✗";
    console.log(`  ${mark} ${d.label.padEnd(50)} (${d.hits} hits)`);
  }

  console.log(`\n◾ Reading-intent test (Sarah/Mark email): ${readingTest ? "✓" : "✗ MANDATORY but not done"}`);
  console.log(`◾ English-only:                          ${englishOnly ? "✓" : "✗ Vietnamese chars detected"}`);
  console.log(`◾ Closing phrase template:               ${closing ? "✓" : "✗ wrap-up phrase missing"}`);

  // ISS-053 regression check: turn 1 deliberately answers BOTH role and
  // responsibilities. Print every agent turn that still matched the
  // "responsibilities" or "role_seniority" triggers AFTER that point, so a
  // human can eyeball whether it's Aria re-asking from scratch (a fail) or
  // just referencing/building on what Lan already said (fine).
  const laterAgentTurns = transcript.filter((t) => t.role === "agent").slice(1);
  const roleOrRespDim = DIMENSIONS.filter((d) =>
    ["role_seniority", "responsibilities"].includes(d.key)
  );
  const possibleReasks = laterAgentTurns.filter((t) =>
    roleOrRespDim.some((d) => d.triggers.some((re) => re.test(t.message)))
  );
  console.log(
    `\n◾ ISS-053 check — turns after #1 matching role/responsibility triggers (${possibleReasks.length}); ` +
      `review manually for "re-ask from scratch" vs. "referencing what was already said":`
  );
  for (const t of possibleReasks) {
    console.log(`  [ARIA] ${t.message}`);
  }

  // Save full transcript for human review.
  const path = `qa-transcript-${Date.now()}.json`;
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(path, JSON.stringify({ transcript }, null, 2))
  );
  console.log(`\n◾ Full transcript saved → ${path}\n`);

  // Print first 6 and last 4 turns for at-a-glance review (they've already
  // scrolled by live above, so this is mainly useful for a long transcript).
  console.log("◾ Transcript (first 6 + last 4 turns):\n");
  const head = transcript.slice(0, 6);
  const tail = transcript.length > head.length ? transcript.slice(Math.max(head.length, transcript.length - 4)) : [];
  for (const t of head) {
    const tag = t.role === "agent" ? "ARIA" : "LAN ";
    console.log(`  [${tag}] ${t.message}`);
  }
  if (transcript.length > head.length + tail.length) {
    console.log(`  ... ${transcript.length - head.length - tail.length} turns omitted ...`);
  }
  for (const t of tail) {
    const tag = t.role === "agent" ? "ARIA" : "LAN ";
    console.log(`  [${tag}] ${t.message}`);
  }
  console.log();

  if (overall !== "PASS") process.exit(1);
}

main().catch((err) => {
  console.error("\n✗ QA failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
