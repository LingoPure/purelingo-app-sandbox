import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

loadEnvLocal();

const TESTERS = [
  { email: "danjmaneveld@gmail.com", name: "Dan" },
  { email: "thaolamx@gmail.com", name: "Thao" },
  { email: "shamini.bhaskaran@gmail.com", name: "Shamini" },
  { email: "mcmdennis@gmail.com", name: "Dennis" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Create or find "LingoPure Demo" Employer
  const { data: existingEmployer } = await supabase
    .from("employers")
    .select("id")
    .eq("name", "LingoPure Demo")
    .maybeSingle();

  let employerId = existingEmployer?.id;
  if (!employerId) {
    const { data: newEmployer, error: empErr } = await supabase
      .from("employers")
      .insert({ name: "LingoPure Demo", default_native_language: "en" })
      .select("id")
      .single();
    if (empErr) throw empErr;
    employerId = newEmployer.id;
    console.log("Created LingoPure Demo Employer:", employerId);
  } else {
    console.log("Found existing LingoPure Demo Employer:", employerId);
  }

  // 2. Create roles if they don't exist
  const rolesToCreate = [
    { name: "General Business", description: "General office communication and business English", baseline: 55 },
    { name: "Customer Service", description: "Support interactions and client communication", baseline: 65 },
    { name: "Technical / IT", description: "Technical discussions and documentation", baseline: 70 },
  ];

  const BASELINE_SKILLS = [
    "speaking",
    "listening",
    "writing",
    "reading",
    "grammar",
    "live_interaction",
  ];

  for (const r of rolesToCreate) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("employer_id", employerId)
      .eq("name", r.name)
      .maybeSingle();

    let roleId = existing?.id;
    if (!roleId) {
      const { data: createdRole, error } = await supabase
        .from("roles")
        .insert({ name: r.name, description: r.description, employer_id: employerId })
        .select("id")
        .single();
      if (error) {
        console.error(`Failed to create role ${r.name}:`, error.message);
        continue;
      }
      roleId = createdRole.id;
      console.log(`Created role: ${r.name}`);
    } else {
      console.log(`Role already exists: ${r.name}`);
    }

    // Seed the six baseline skills for the role.
    const { error: baselineErr } = await supabase.from("role_baselines").upsert(
      BASELINE_SKILLS.map((skill) => ({
        role_id: roleId,
        skill,
        min_score: r.baseline,
      })),
      { onConflict: "role_id,skill" }
    );
    if (baselineErr) console.error(`Failed to seed baselines for ${r.name}:`, baselineErr.message);
    else console.log(`Seeded 6 baselines for ${r.name}`);
  }

  // 3. Process testers: ensure they are students and link to employer
  const { data: allUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const t of TESTERS) {
    const authUser = allUsers?.users.find(
      (u) => (u.email ?? "").toLowerCase() === t.email.toLowerCase()
    );
    if (!authUser) {
      console.log(`Auth user not found for ${t.email}. Skipping student creation. (Testers need to sign up once first).`);
      continue;
    }

    const { error: upsertErr } = await supabase
      .from("students")
      .upsert({
        id: authUser.id,
        email: t.email,
        name: t.name,
        employer_id: employerId,
      }, { onConflict: "id" });

    if (upsertErr) console.error(`Failed to upsert student ${t.email}:`, upsertErr.message);
    else console.log(`Ensured student: ${t.email} linked to employer`);
  }

  console.log("\nDone! Testers should now see 'General Business', 'Customer Service', and 'Technical / IT' roles on onboarding.");
}

main().catch(console.error);
