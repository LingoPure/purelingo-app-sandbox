import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("Creating Org: ABC Manufacturer Org...");
  const { data: org, error: orgErr } = await sb
    .from("organisations")
    .upsert({ name: "ABC Manufacturer", slug: "abc-manufacturer" }, { onConflict: "slug" })
    .select("id")
    .single();

  if (orgErr) throw orgErr;

  console.log(`Org created: ${org.id}. Seeding data for 12 students...`);

  // Get ABC Employer
  const { data: employer } = await sb
    .from("employers")
    .select("id")
    .eq("name", "ABC Manufacturer")
    .single();

  const { data: students } = await sb
    .from("students")
    .select("id, name, email")
    .eq("employer_id", employer!.id);

  for (const s of students!) {
    console.log(`Seeding discovery for ${s.name}...`);
    const slug = s.email!.split("@")[0];
    
    // 1. Discovery Session
    const { data: sess, error: sessErr } = await sb
      .from("discovery_sessions")
      .upsert({
        student_id: s.id,
        convai_conversation_id: `seed-abc-${slug}`,
        status: "complete",
        completed_at: new Date().toISOString(),
        profile_json: {
          overall_cefr: "B2",
          target_level: "B2",
          target_why: "Professional development",
          summary: "Student shows strong communicative intent but needs register refinement.",
          speaking: { score: 750, cefr_band: "B2", evidence: "Confident and articulate." },
          listening: { score: 700, cefr_band: "B1", evidence: "Understands core request." },
          writing: { score: 650, cefr_band: "B1", evidence: "Formal structure is inconsistent." },
          reading: { score: 700, cefr_band: "B2", evidence: "Good grasp of nuances." },
          grammar: { score: 680, cefr_band: "B1", evidence: "Occasional tense slips under pressure." },
          live_interaction: { score: 690, cefr_band: "B1", evidence: "Handles follow-up questions but pace slows." },
          business_vocabulary: { score: 720, cefr_band: "B2", evidence: "Strong technical range." },
          presentation_delivery: { score: 680, cefr_band: "B1", evidence: "Needs structural work." }
        }
      })
      .select("id")
      .single();

    if (sessErr) { console.error(sessErr); continue; }

    // 2. Gap Scores
    const skills = [
      "speaking", "listening", "writing", "reading",
      "grammar", "live_interaction", "business_vocabulary", "presentation_delivery"
    ];
    
    for (const skill of skills) {
      await sb.from("gap_scores").upsert({
        student_id: s.id,
        skill: skill,
        score: Math.floor(Math.random() * 300) + 500, // 500-800
        target: 800,
        source: "discovery",
        is_canonical: true
      });
    }
  }

  console.log("Done.");
}

main().catch(console.error);
