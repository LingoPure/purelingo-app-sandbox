import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DEMO_EMPLOYER = "ea305cc9-d649-48fc-8be2-3e06c100d8b8";

const { data: orphans, error } = await supabase
  .from("students")
  .select("id, email, employer_id")
  .is("employer_id", null);

if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

console.log(`Found ${orphans.length} students with no employer:`);
for (const o of orphans) console.log("  -", o.email);

const { data: updated, error: upErr } = await supabase
  .from("students")
  .update({ employer_id: DEMO_EMPLOYER })
  .is("employer_id", null);

console.log("Update error:", upErr?.message ?? "none");