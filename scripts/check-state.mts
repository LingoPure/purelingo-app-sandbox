import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const { data: d, error } = await supabase
  .from("students")
  .select("id, email, name, employer_id, role_id")
  .eq("email", "mcmdennis@gmail.com");
console.log("MCM:", JSON.stringify(d), error?.message ?? "");

const { data: demoEmployer } = await supabase
  .from("employers")
  .select("id, name")
  .eq("id", "ea305cc9-d649-48fc-8be2-3e06c100d8b8");
console.log("EMPLOYER:", JSON.stringify(demoEmployer));

const { data: demoRoles } = await supabase
  .from("roles")
  .select("id, name, employer_id");
console.log("ROLES:", JSON.stringify(demoRoles));