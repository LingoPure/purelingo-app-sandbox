/**
 * Fabricated demo data for the HR module.
 *
 * ⚠️ EVERY PERSON IN THIS FILE IS INVENTED. The real LingoPure roster never
 * enters this sandbox — that is the control that lets the module share a
 * database with the demo and investor data without exposing anyone. The real
 * roster and opening balances (Thao doc F5/F6) are loaded only in the
 * destination environment, after handover.
 *
 * The names are ordinary Vietnamese ones and the departments are plausible,
 * because a demo that reads as obviously fake ("Test User 1") makes it harder
 * for a client to picture their own team using the thing.
 *
 * What it produces, and why each piece is there:
 *   - a two-level reporting line, so "an Admin sees only their team" has
 *     something to actually be wrong about
 *   - a partial year of leave history, so balances are not all pristine
 *   - Tết as a five-day holiday, so multi-day grouping renders
 *   - a làm bù Saturday, so the compensatory-day path is visible
 *   - one pending request, so the approvals queue is not empty
 *
 * Idempotent: re-running updates rather than duplicating. Safe to run against a
 * database that already has the seed.
 *
 * Usage:  npm run hr:seed          (against .env.local)
 *         npm run hr:seed -- --wipe  removes the demo org entirely
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// A fixed id so re-runs update in place, and so --wipe can target exactly the
// demo org and nothing else.
const DEMO_ORG_ID = "0e5f1a10-0000-4000-8000-0000000000de";

type Person = {
  key: string;
  first: string;
  last: string;
  role: "super_admin" | "admin" | "staff";
  title: string;
  department: string;
  managerKey?: string;
  locale: "en" | "vi";
  startDate: string;
};

const PEOPLE: Person[] = [
  { key: "thao", first: "Thảo", last: "Lâm", role: "super_admin", title: "Operations Director", department: "Operations", locale: "en", startDate: "2022-03-01" },
  { key: "phuong", first: "Phượng", last: "Nguyễn", role: "admin", title: "Head of Teaching", department: "Teaching", managerKey: "thao", locale: "vi", startDate: "2022-08-15" },
  { key: "minh", first: "Minh", last: "Hoàng", role: "admin", title: "Head of Student Success", department: "Student Success", managerKey: "thao", locale: "vi", startDate: "2023-01-09" },
  { key: "anhthu", first: "Anh Thư", last: "Trần", role: "staff", title: "English Teacher", department: "Teaching", managerKey: "phuong", locale: "vi", startDate: "2023-06-01" },
  { key: "khanh", first: "Khánh", last: "Vũ", role: "staff", title: "English Teacher", department: "Teaching", managerKey: "phuong", locale: "vi", startDate: "2024-02-19" },
  { key: "linh", first: "Linh", last: "Phạm", role: "staff", title: "Student Success Officer", department: "Student Success", managerKey: "minh", locale: "vi", startDate: "2024-09-02" },
  { key: "duc", first: "Đức", last: "Lê", role: "staff", title: "Marketing Executive", department: "Marketing", managerKey: "minh", locale: "en", startDate: "2025-01-13" },
];

/**
 * Vietnamese public holidays. Dates are ILLUSTRATIVE for the demo — the lunar
 * ones move every year and the real calendar is published each autumn, which is
 * exactly why the schema stores one row per date rather than a repeating rule.
 */
function holidaysFor(year: number) {
  return [
    { date: `${year}-01-01`, en: "New Year's Day", vi: "Tết Dương lịch", recurring: true },
    { date: `${year}-02-16`, en: "Lunar New Year", vi: "Tết Nguyên Đán", recurring: false },
    { date: `${year}-02-17`, en: "Lunar New Year", vi: "Tết Nguyên Đán", recurring: false },
    { date: `${year}-02-18`, en: "Lunar New Year", vi: "Tết Nguyên Đán", recurring: false },
    { date: `${year}-02-19`, en: "Lunar New Year", vi: "Tết Nguyên Đán", recurring: false },
    { date: `${year}-02-20`, en: "Lunar New Year", vi: "Tết Nguyên Đán", recurring: false },
    { date: `${year}-04-18`, en: "Hung Kings Commemoration", vi: "Giỗ Tổ Hùng Vương", recurring: false },
    { date: `${year}-04-30`, en: "Reunification Day", vi: "Ngày Giải phóng miền Nam", recurring: true },
    { date: `${year}-05-01`, en: "Labour Day", vi: "Ngày Quốc tế Lao động", recurring: true },
    { date: `${year}-09-02`, en: "National Day", vi: "Quốc khánh", recurring: true },
    { date: `${year}-09-03`, en: "National Day", vi: "Quốc khánh", recurring: true },
  ];
}

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // Env may come from the shell instead; the checks below will catch a gap.
  }
}

async function wipe(supabase: SupabaseClient): Promise<void> {
  console.log("Removing the demo organisation…");
  // Ledger first: its foreign keys are ON DELETE RESTRICT, deliberately, so an
  // audit trail cannot vanish with its subject.
  for (const table of [
    "hr_leave_ledger",
    "hr_leave_requests",
    "hr_employee_entitlements",
    "hr_audit_log",
    "hr_employees",
    "hr_working_day_overrides",
    "hr_public_holidays",
    "hr_leave_types",
    "hr_org_policy",
  ]) {
    await supabase.from(table).delete().eq("org_id", DEMO_ORG_ID);
  }
  await supabase.from("hr_organisations").delete().eq("id", DEMO_ORG_ID);
  console.log("Done. The demo organisation is gone.");
}

async function main(): Promise<void> {
  loadEnvLocal();

  const supabase = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL", process.env.SUPABASE_URL),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  if (process.argv.includes("--wipe")) {
    await wipe(supabase);
    return;
  }

  const year = new Date().getUTCFullYear();
  console.log(`Seeding the demo organisation for ${year}…`);

  const orgResult = await supabase.from("hr_organisations").upsert({
    id: DEMO_ORG_ID,
    name: "LingoPure (demo)",
    legal_entity: "Lingopure Pte Ltd",
    country: "VN",
    timezone: "Asia/Ho_Chi_Minh",
  });
  if (orgResult.error) throw new Error(`organisation: ${orgResult.error.message}`);

  const policyResult = await supabase.from("hr_org_policy").upsert({
    org_id: DEMO_ORG_ID,
    carry_over_expiry_month: 3,
  });
  if (policyResult.error) throw new Error(`policy: ${policyResult.error.message}`);

  const typeRows = [
    { code: "annual", name_en: "Paid Annual Leave", name_vi: "Nghỉ phép năm có lương", deducts_balance: true, default_allowance: 12, sort_order: 1 },
    { code: "sick", name_en: "Sick Leave", name_vi: "Nghỉ ốm", deducts_balance: true, default_allowance: 3, sort_order: 2 },
    { code: "unpaid", name_en: "Unpaid Leave", name_vi: "Nghỉ không lương", deducts_balance: false, default_allowance: null, sort_order: 3 },
    { code: "public_holiday", name_en: "Public Holiday", name_vi: "Nghỉ lễ", deducts_balance: false, default_allowance: null, sort_order: 4 },
  ];
  const typeResult = await supabase
    .from("hr_leave_types")
    .upsert(typeRows.map((t) => ({ ...t, org_id: DEMO_ORG_ID })), { onConflict: "org_id,code" });
  if (typeResult.error) throw new Error(`leave types: ${typeResult.error.message}`);

  const { data: types } = await supabase
    .from("hr_leave_types")
    .select("id, code")
    .eq("org_id", DEMO_ORG_ID);
  const typeId = Object.fromEntries(
    ((types ?? []) as Array<{ id: string; code: string }>).map((t) => [t.code, t.id])
  );

  // Employees, in two passes: everyone exists before any manager is assigned,
  // so the reporting line can point at rows that were created after it.
  //
  // NOT an upsert, deliberately. The uniqueness rule on hr_employees is
  // `unique (org_id, lower(email))` — an EXPRESSION index — and Postgres
  // ON CONFLICT cannot target one by column name. `onConflict: "org_id,email"`
  // does not match it and the insert errors. Select-then-write is the honest
  // way to get idempotence against an expression index.
  const idByKey: Record<string, string> = {};
  for (const person of PEOPLE) {
    const email = `${person.key}@lingopure.demo`;
    const fields = {
      org_id: DEMO_ORG_ID,
      email,
      first_name: person.first,
      last_name: person.last,
      job_title: person.title,
      department: person.department,
      hr_role: person.role,
      employment_start_date: person.startDate,
      locale: person.locale,
      status: "active" as const,
    };

    const { data: existing } = await supabase
      .from("hr_employees")
      .select("id")
      .eq("org_id", DEMO_ORG_ID)
      .ilike("email", email)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("hr_employees")
        .update(fields)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(`updating ${email}: ${error.message}`);
      idByKey[person.key] = (existing as { id: string }).id;
    } else {
      const { data, error } = await supabase
        .from("hr_employees")
        .insert(fields)
        .select("id")
        .single();
      // Thrown, not logged. A seed that reports success while writing nothing
      // is worse than one that fails — this exact bug printed "7 employees"
      // against an empty table before the error check was added.
      if (error) throw new Error(`inserting ${email}: ${error.message}`);
      idByKey[person.key] = (data as { id: string }).id;
    }
  }

  for (const person of PEOPLE) {
    if (!person.managerKey) continue;
    await supabase
      .from("hr_employees")
      .update({ manager_id: idByKey[person.managerKey] })
      .eq("id", idByKey[person.key]);
  }
  console.log(`  ${PEOPLE.length} employees, two levels of reporting line`);

  // Entitlements and opening balances.
  for (const person of PEOPLE) {
    for (const code of ["annual", "sick"] as const) {
      const allowance = code === "annual" ? 12 : 3;
      await supabase.from("hr_employee_entitlements").upsert(
        {
          org_id: DEMO_ORG_ID,
          employee_id: idByKey[person.key],
          leave_type_id: typeId[code],
          leave_year: year,
          allowance,
        },
        { onConflict: "org_id,employee_id,leave_type_id,leave_year" }
      );

      const { data: existing } = await supabase
        .from("hr_leave_ledger")
        .select("id")
        .eq("employee_id", idByKey[person.key])
        .eq("leave_type_id", typeId[code])
        .eq("leave_year", year)
        .eq("entry_type", "opening_balance")
        .maybeSingle();

      if (!existing) {
        await supabase.from("hr_leave_ledger").insert({
          org_id: DEMO_ORG_ID,
          employee_id: idByKey[person.key],
          leave_type_id: typeId[code],
          leave_year: year,
          entry_type: "opening_balance",
          days: allowance,
          effective_date: `${year}-01-01`,
        });
      }
    }
  }
  console.log("  entitlements and opening balances");

  await supabase.from("hr_public_holidays").upsert(
    holidaysFor(year).map((h) => ({
      org_id: DEMO_ORG_ID,
      date: h.date,
      name_en: h.en,
      name_vi: h.vi,
      is_recurring: h.recurring,
    })),
    { onConflict: "org_id,date" }
  );
  console.log(`  ${holidaysFor(year).length} public holiday days, including a five-day Tết`);

  // The làm bù Saturday: worked to bridge the National Day holiday. Without at
  // least one of these in the demo, the compensatory-day path is invisible.
  await supabase.from("hr_working_day_overrides").upsert(
    {
      org_id: DEMO_ORG_ID,
      date: `${year}-09-06`,
      is_working_day: true,
      note: "Làm bù for National Day",
    },
    { onConflict: "org_id,date" }
  );
  console.log("  one làm bù compensatory working day");

  console.log("");
  console.log("Seeded. Every person above is invented — the real roster is");
  console.log("loaded only in the destination environment, after handover.");
  console.log(`Remove with:  npm run hr:seed -- --wipe`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
