/**
 * CSV bulk staff import.
 *
 * Format (header required, columns can appear in any order):
 *   name,email,role,target_level,native_language
 *
 * - role matches roles.name within the active employer (case-insensitive).
 *   Unknown role → row reported as error, NOT created.
 * - target_level defaults to "B2" when blank.
 * - native_language is optional. When blank we leave the column unset on
 *   the students row so it cascades to the employer default at read time.
 *   Accepts a 2-letter code (e.g. "vi", "en") — no validation against the
 *   supported set; unknown codes will simply fall through at read time.
 * - Existing auth users are looked up by email; the students row gets
 *   updated rather than duplicated. handle_new_user trigger creates the
 *   row on signup, so for new users we create the auth user and then
 *   update the auto-created students row.
 *
 * Designed for the 1,000-staff scale: imports run in chunks of 50 with
 * Promise.all per chunk so a giant CSV doesn't open 1,000 simultaneous
 * Supabase connections.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const CHUNK_SIZE = 50;
const VALID_TARGET_LEVELS = ["A2", "B1", "B2", "C1", "C2"] as const;
type TargetLevel = (typeof VALID_TARGET_LEVELS)[number];

export type ParsedRow = {
  rowNumber: number;
  name: string;
  email: string;
  roleName: string;
  targetLevel: TargetLevel;
  /** Lower-cased 2-letter code, or null if column omitted/blank. */
  nativeLanguage: string | null;
};

export type ParseError = {
  rowNumber: number;
  raw: string;
  error: string;
};

export type ParseResult = {
  rows: ParsedRow[];
  errors: ParseError[];
};

export type ImportRowOutcome = {
  rowNumber: number;
  email: string;
  status: "created" | "updated" | "error";
  message?: string;
};

export type ImportResult = {
  attempted: number;
  created: number;
  updated: number;
  errors: number;
  outcomes: ImportRowOutcome[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tiny CSV parser. Handles quoted fields with embedded commas, escaped
 * quotes ("" → "), and CRLF line endings. Doesn't pull in a dep — our
 * format is small and well-controlled.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur === "") {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseStaffCsv(csv: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  const lines = csv
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  // Drop trailing blank lines.
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    return { rows, errors: [{ rowNumber: 0, raw: "", error: "Empty file" }] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    name: header.indexOf("name"),
    email: header.indexOf("email"),
    role: header.indexOf("role"),
    target_level: header.indexOf("target_level"),
    native_language: header.indexOf("native_language"),
  };
  if (idx.name === -1 || idx.email === -1 || idx.role === -1) {
    return {
      rows,
      errors: [
        {
          rowNumber: 1,
          raw: lines[0],
          error: "Header must include name, email, role (target_level optional)",
        },
      ],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const fields = splitCsvLine(line);
    const name = fields[idx.name] ?? "";
    const email = (fields[idx.email] ?? "").toLowerCase();
    const roleName = fields[idx.role] ?? "";
    const tlRaw =
      idx.target_level === -1 ? "" : (fields[idx.target_level] ?? "").toUpperCase();
    const targetLevel = (tlRaw || "B2") as string;
    const nlRaw =
      idx.native_language === -1
        ? ""
        : (fields[idx.native_language] ?? "").toLowerCase();
    const nativeLanguage = nlRaw || null;

    if (!name) {
      errors.push({ rowNumber: i + 1, raw: line, error: "Missing name" });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ rowNumber: i + 1, raw: line, error: "Invalid email" });
      continue;
    }
    if (!roleName) {
      errors.push({ rowNumber: i + 1, raw: line, error: "Missing role" });
      continue;
    }
    if (!VALID_TARGET_LEVELS.includes(targetLevel as TargetLevel)) {
      errors.push({
        rowNumber: i + 1,
        raw: line,
        error: `target_level must be one of ${VALID_TARGET_LEVELS.join(", ")}`,
      });
      continue;
    }

    rows.push({
      rowNumber: i + 1,
      name,
      email,
      roleName,
      targetLevel: targetLevel as TargetLevel,
      nativeLanguage,
    });
  }

  return { rows, errors };
}

function randomPassword(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

async function loadEmailToAuthId(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return map;
}

async function loadRolesByLowerName(
  supabase: SupabaseClient,
  employerId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .eq("employer_id", employerId)
    .eq("is_archived", false)
    .returns<{ id: string; name: string }[]>();
  if (error) throw new Error(`roles lookup failed: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.name.toLowerCase(), r.id]));
}

async function loadEmployerDefaultLanguage(
  supabase: SupabaseClient,
  employerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("employers")
    .select("default_native_language")
    .eq("id", employerId)
    .maybeSingle();
  return (
    (data as { default_native_language?: string } | null)
      ?.default_native_language ?? null
  );
}

export async function importStaffRows(
  supabase: SupabaseClient,
  employerId: string,
  rows: ParsedRow[]
): Promise<ImportResult> {
  const result: ImportResult = {
    attempted: rows.length,
    created: 0,
    updated: 0,
    errors: 0,
    outcomes: [],
  };

  if (rows.length === 0) return result;

  const [emailToAuthId, rolesByName, employerDefaultLang] = await Promise.all([
    loadEmailToAuthId(supabase),
    loadRolesByLowerName(supabase, employerId),
    loadEmployerDefaultLanguage(supabase, employerId),
  ]);

  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const outcomes = await Promise.all(
      chunk.map((row) =>
        importOneRow(
          supabase,
          employerId,
          row,
          emailToAuthId,
          rolesByName,
          employerDefaultLang
        )
      )
    );
    for (const outcome of outcomes) {
      result.outcomes.push(outcome);
      if (outcome.status === "created") result.created += 1;
      else if (outcome.status === "updated") result.updated += 1;
      else result.errors += 1;
    }
  }

  return result;
}

async function importOneRow(
  supabase: SupabaseClient,
  employerId: string,
  row: ParsedRow,
  emailToAuthId: Map<string, string>,
  rolesByName: Map<string, string>,
  employerDefaultLang: string | null
): Promise<ImportRowOutcome> {
  const roleId = rolesByName.get(row.roleName.toLowerCase());
  if (!roleId) {
    return {
      rowNumber: row.rowNumber,
      email: row.email,
      status: "error",
      message: `Unknown role "${row.roleName}"`,
    };
  }

  let userId = emailToAuthId.get(row.email);
  let isNew = false;
  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: row.name },
    });
    if (error || !created.user) {
      return {
        rowNumber: row.rowNumber,
        email: row.email,
        status: "error",
        message: error?.message ?? "createUser failed",
      };
    }
    userId = created.user.id;
    emailToAuthId.set(row.email, userId);
    isNew = true;
  }

  const resolvedLang = row.nativeLanguage ?? employerDefaultLang ?? null;
  const { error: studentErr } = await supabase
    .from("students")
    .update({
      name: row.name,
      email: row.email,
      target_level: row.targetLevel,
      employer_id: employerId,
      role_id: roleId,
      ...(resolvedLang ? { native_language: resolvedLang } : {}),
    })
    .eq("id", userId);
  if (studentErr) {
    return {
      rowNumber: row.rowNumber,
      email: row.email,
      status: "error",
      message: studentErr.message,
    };
  }

  return {
    rowNumber: row.rowNumber,
    email: row.email,
    status: isNew ? "created" : "updated",
  };
}
