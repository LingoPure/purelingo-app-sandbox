/**
 * Opening-balance import, for a mid-year go-live.
 *
 * THE PROBLEM. The ledger is the only source of a balance, so on the day the
 * system starts everyone reads as having their full entitlement untouched. If
 * the company goes live in August and Chi has already taken six days, the system
 * will happily let her take twelve more. This script carries that history in.
 *
 * WHY TWO LEDGER ROWS PER TYPE, not one net figure:
 *
 *   opening_balance    +12.0   their entitlement for the year
 *   manual_adjustment   -6.0   "Taken before go-live" (reason mandatory)
 *
 * A single +6.0 row would balance correctly and destroy the explanation. Six
 * months later, when somebody asks why Chi started the year with six days, the
 * ledger has to answer — and "6" does not. The manual_adjustment CHECK
 * constraint requires a reason precisely so this cannot be recorded anonymously.
 *
 * NOT NEEDED FOR A 1 JANUARY GO-LIVE. Everyone starts at their full entitlement
 * and there is no history to carry. That is why the questions doc asks about the
 * go-live date: a January start removes this step entirely.
 *
 * CSV format (header required, extra columns ignored):
 *
 *   email,annual_allowance,annual_taken,sick_allowance,sick_taken
 *   chi@lingopure.com,12,6,3,1
 *   dung@lingopure.com,12,0,3,0
 *
 * Idempotent: re-running replaces this employee's import rows rather than
 * stacking another deduction on top. Safe to fix the spreadsheet and run again.
 *
 * Usage:  npm run hr:import-balances -- --file roster.csv --org <uuid>
 *         npm run hr:import-balances -- --file roster.csv --org <uuid> --dry-run
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const IMPORT_REASON = "Taken before go-live (imported)";

type Row = {
  email: string;
  annualAllowance: number;
  annualTaken: number;
  sickAllowance: number;
  sickTaken: number;
  line: number;
};

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadEnvLocal(): void {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      if (!process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* env may come from the shell */
  }
}

/**
 * Parse and validate the whole file before touching the database.
 *
 * Deliberately all-or-nothing. A partial import leaves some people with correct
 * balances and some without, and no way to tell which from looking — far worse
 * than a rejected file and a fixed spreadsheet.
 */
function parse(csv: string): Row[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("The file has a header but no rows.");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["email", "annual_allowance", "annual_taken", "sick_allowance", "sick_taken"];
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(`Missing column(s): ${missing.join(", ")}. Expected: ${required.join(",")}`);
  }
  const at = (name: string) => header.indexOf(name);

  const rows: Row[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const line = i + 1;
    const email = (cells[at("email")] ?? "").toLowerCase();

    if (!email.includes("@")) {
      errors.push(`line ${line}: "${email}" is not an email address`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`line ${line}: ${email} appears more than once`);
      continue;
    }
    seen.add(email);

    const num = (column: string): number => {
      const raw = cells[at(column)] ?? "";
      const value = Number(raw === "" ? "0" : raw);
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`line ${line}: ${column} "${raw}" is not a number of days`);
        return 0;
      }
      // Half days are the smallest unit the system understands anywhere.
      if (Math.round(value * 2) !== value * 2) {
        errors.push(`line ${line}: ${column} "${raw}" must be in whole or half days`);
        return 0;
      }
      return value;
    };

    const row: Row = {
      email,
      annualAllowance: num("annual_allowance"),
      annualTaken: num("annual_taken"),
      sickAllowance: num("sick_allowance"),
      sickTaken: num("sick_taken"),
      line,
    };

    // Catches a transposed spreadsheet column before it silently hands someone a
    // negative balance on their first day.
    if (row.annualTaken > row.annualAllowance) {
      errors.push(
        `line ${line}: annual_taken (${row.annualTaken}) exceeds annual_allowance (${row.annualAllowance})`
      );
    }
    if (row.sickTaken > row.sickAllowance) {
      errors.push(
        `line ${line}: sick_taken (${row.sickTaken}) exceeds sick_allowance (${row.sickAllowance})`
      );
    }

    rows.push(row);
  }

  if (errors.length) {
    throw new Error(`The file has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  }
  return rows;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const file = arg("file");
  const orgId = arg("org");
  const dryRun = process.argv.includes("--dry-run");

  if (!file || !orgId) {
    throw new Error("Usage: --file <csv> --org <organisation uuid> [--dry-run]");
  }

  const rows = parse(readFileSync(file, "utf8"));
  const year = Number(arg("year") ?? new Date().getUTCFullYear());

  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: typeRows } = await supabase
    .from("hr_leave_types")
    .select("id, code")
    .eq("org_id", orgId);
  const typeId = Object.fromEntries(
    ((typeRows ?? []) as Array<{ id: string; code: string }>).map((t) => [t.code, t.id])
  );
  if (!typeId.annual || !typeId.sick) {
    throw new Error(`Organisation ${orgId} has no annual/sick leave types. Wrong org id?`);
  }

  // Resolve every employee BEFORE writing anything, so an address that does not
  // match stops the run rather than importing everyone else and reporting a
  // warning nobody reads.
  const resolved: Array<Row & { employeeId: string }> = [];
  const unmatched: string[] = [];
  for (const row of rows) {
    const { data } = await supabase
      .from("hr_employees")
      .select("id")
      .eq("org_id", orgId)
      .ilike("email", row.email)
      .maybeSingle();
    if (!data) unmatched.push(`line ${row.line}: no employee with ${row.email}`);
    else resolved.push({ ...row, employeeId: (data as { id: string }).id });
  }
  if (unmatched.length) {
    throw new Error(
      `${unmatched.length} address(es) did not match an employee. Load the roster first.\n  ` +
        unmatched.join("\n  ")
    );
  }

  console.log(`${resolved.length} employees matched, leave year ${year}`);
  if (dryRun) {
    for (const row of resolved) {
      console.log(
        `  ${row.email}: annual ${row.annualAllowance - row.annualTaken}/${row.annualAllowance}` +
          `, sick ${row.sickAllowance - row.sickTaken}/${row.sickAllowance}`
      );
    }
    console.log("\nDry run — nothing written.");
    return;
  }

  for (const row of resolved) {
    for (const code of ["annual", "sick"] as const) {
      const allowance = code === "annual" ? row.annualAllowance : row.sickAllowance;
      const taken = code === "annual" ? row.annualTaken : row.sickTaken;

      await supabase.from("hr_employee_entitlements").upsert(
        {
          org_id: orgId,
          employee_id: row.employeeId,
          leave_type_id: typeId[code],
          leave_year: year,
          allowance,
        },
        { onConflict: "org_id,employee_id,leave_type_id,leave_year" }
      );

      // Idempotence: clear this employee's previous IMPORT rows only. Anything
      // recorded by the running system — approvals, cancellations, adjustments
      // made by a human — is left strictly alone.
      await supabase
        .from("hr_leave_ledger")
        .delete()
        .eq("org_id", orgId)
        .eq("employee_id", row.employeeId)
        .eq("leave_type_id", typeId[code])
        .eq("leave_year", year)
        .in("entry_type", ["opening_balance"]);
      await supabase
        .from("hr_leave_ledger")
        .delete()
        .eq("org_id", orgId)
        .eq("employee_id", row.employeeId)
        .eq("leave_type_id", typeId[code])
        .eq("leave_year", year)
        .eq("entry_type", "manual_adjustment")
        .eq("reason", IMPORT_REASON);

      const entries: Array<Record<string, unknown>> = [
        {
          org_id: orgId,
          employee_id: row.employeeId,
          leave_type_id: typeId[code],
          leave_year: year,
          entry_type: "opening_balance",
          days: allowance,
          effective_date: `${year}-01-01`,
        },
      ];

      // Two rows, not one net figure — the history has to explain itself.
      if (taken > 0) {
        entries.push({
          org_id: orgId,
          employee_id: row.employeeId,
          leave_type_id: typeId[code],
          leave_year: year,
          entry_type: "manual_adjustment",
          days: -taken,
          effective_date: `${year}-01-01`,
          reason: IMPORT_REASON,
        });
      }

      const { error } = await supabase.from("hr_leave_ledger").insert(entries);
      if (error) throw new Error(`${row.email} (${code}): ${error.message}`);
    }
    console.log(`  ${row.email}`);
  }

  console.log(`\nImported ${resolved.length} employees.`);
  console.log("Each shows their full entitlement plus a dated, reasoned deduction");
  console.log("for leave taken before go-live — so the history explains itself.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
