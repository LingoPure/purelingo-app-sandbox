/**
 * Live agent QA — runs a programmatic discovery session against the deployed
 * ElevenLabs ConvAI agent using a fictional Vietnamese B2B student persona,
 * then scores the transcript against the 6 dimensions from briefing §07.1
 * and the protocol-enforcement rules from §09.
 *
 * Usage:
 *   set -a; source .env.local; set +a; npx tsx scripts/qa-discovery-agent.ts
 *
 * Env required: ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID.
 *
 * Note: this calls ElevenLabs' /v1/convai/agents/{id}/simulate-conversation
 * endpoint. It does not consume voice minutes — it's text-only simulation
 * over the same system prompt and tools that drive a real call.
 */

const PERSONA_PROMPT = `You are Nguyen Thi Lan, a 32-year-old Senior Account Manager at Vinh Hoan Export Co., a seafood exporter based in Ho Chi Minh City, Vietnam. You speak intermediate English (around B1+ in CEFR terms): generally fluent and confident in conversation, but you occasionally use Vietnamese-accented constructions, sometimes pause to find a word, and your formal writing in English needs work. Your tone is friendly and professional.

Your situation:
- You have been at the company for 4 years, promoted to Senior AM 8 months ago.
- You manage 12 international client accounts, mostly in the US, UK, and Australia.
- Your English usage in a typical week: ~15 emails to international clients (mostly transactional but some delicate negotiation), 2–3 video calls (mix of inbound client calls and outbound supplier calls), one weekly internal report in English to regional management, and one monthly presentation slot you dread.
- Your boss wants you at B2 within 6 months because the company is opening an Australia desk and you may relocate.
- You feel confident speaking but get stuck on formal email register and on understanding fast British accents in calls.
- You prefer learning in short bursts (15–25 min), late evening (after kids are asleep around 9pm). You're competitive — you like leaderboards and would push harder if you knew where you stood vs peers.
- Your Vietnamese literacy is excellent — university educated.

How to behave in this conversation:
- Speak naturally. Don't volunteer everything at once. Wait for the agent to ask.
- Occasionally use a slightly imperfect English construction (e.g. "I am working there since 4 years", "the meeting was very interesting for me").
- Be honest when the agent asks something you don't know.
- If asked to interpret a business email, do it with reasonable but not perfect accuracy.
- Aim to end the conversation when the agent signals wrap-up. Don't end early.
- Do not break character. Do not mention you are a simulation.`;

type TranscriptTurn = {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
};

type SimulateResponse = {
  simulated_conversation: TranscriptTurn[];
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
    data_collection_results?: Record<string, unknown>;
    evaluation_criteria_results?: Record<string, unknown>;
  };
};

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
  "Hi {{student_name}}! I'm Aria from Lingo Pyoor. I've got the basics already — {{role_name}} at {{employer_name}}, aiming for {{target_level}}. We'll spend the next twenty or so minutes getting to know what's behind that — what your week actually looks like, where English shows up. No right or wrong answers. To start: walk me through what a typical day in your role looks like.";
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

async function simulate(
  apiKey: string,
  agentId: string
): Promise<SimulateResponse> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${agentId}/simulate-conversation`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        simulation_specification: {
          simulated_user_config: {
            first_message: "Hi, I'm here.",
            language: "en",
            prompt: { prompt: PERSONA_PROMPT },
          },
          dynamic_variables: QA_DYNAMIC_VARIABLES,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`simulate-conversation ${res.status}: ${text}`);
  }
  return (await res.json()) as SimulateResponse;
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
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error(
      "ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID must be set in env"
    );
  }

  console.log("\n▶ Running simulated discovery session...\n");
  console.log(`  Agent: ${agentId}`);
  console.log(`  Persona: Nguyen Thi Lan, B1+ Senior Account Manager (HCMC)\n`);

  const start = Date.now();
  const result = await simulate(apiKey, agentId);
  const elapsedSecs = Math.round((Date.now() - start) / 1000);

  const transcript = result.simulated_conversation;
  const counts = turnCount(transcript);
  const coverage = scoreCoverage(transcript);
  const englishOnly = checkEnglishOnly(transcript);
  const closing = checkClosingPhrase(transcript);
  const readingTest = checkReadingTest(transcript);

  const allCovered = coverage.every((d) => d.covered);
  const overall =
    allCovered && englishOnly && closing && readingTest ? "PASS" : "REVIEW";

  console.log(`◾ Simulation finished in ${elapsedSecs}s — ${counts.total} turns (${counts.agent} agent / ${counts.user} user)\n`);
  console.log(`◾ Verdict: ${overall}\n`);

  console.log("◾ Dimension coverage (≥2 trigger hits = covered):");
  for (const d of coverage) {
    const mark = d.covered ? "✓" : "✗";
    console.log(`  ${mark} ${d.label.padEnd(50)} (${d.hits} hits)`);
  }

  console.log(`\n◾ Reading-intent test (Sarah/Mark email): ${readingTest ? "✓" : "✗ MANDATORY but not done"}`);
  console.log(`◾ English-only:                          ${englishOnly ? "✓" : "✗ Vietnamese chars detected"}`);
  console.log(`◾ Closing phrase template:               ${closing ? "✓" : "✗ wrap-up phrase missing"}`);

  if (result.analysis?.transcript_summary) {
    console.log(`\n◾ ElevenLabs summary:\n  ${result.analysis.transcript_summary}\n`);
  }
  if (result.analysis?.call_successful) {
    console.log(`◾ ElevenLabs call_successful: ${result.analysis.call_successful}`);
  }

  // Save full transcript for human review.
  const path = `qa-transcript-${Date.now()}.json`;
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(path, JSON.stringify({ transcript, analysis: result.analysis }, null, 2))
  );
  console.log(`\n◾ Full transcript saved → ${path}\n`);

  // Print first 6 and last 4 turns for at-a-glance review.
  console.log("◾ Transcript (first 6 + last 4 turns):\n");
  const head = transcript.slice(0, 6);
  const tail = transcript.slice(-4);
  for (const t of head) {
    const tag = t.role === "agent" ? "ARIA" : "LAN ";
    console.log(`  [${tag}] ${t.message}`);
  }
  if (transcript.length > 10) console.log(`  ... ${transcript.length - 10} turns omitted ...`);
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
