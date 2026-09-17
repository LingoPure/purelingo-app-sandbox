/**
 * Upsert values into `.env.local` (project root). Used by provision scripts so
 * the canonical auto-configuration contract holds: ELEVENLABS_AGENT_ID /
 * ELEVENLABS_WEBHOOK_SECRET / agent ids are written back automatically — never
 * hand-carried from console output. Idempotent: existing keys are replaced in
 * place; missing keys are appended. Preserves comments + ordering of untouched
 * keys. Never prints secrets.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENV_PATH = resolve(ROOT, ".env.local");

/**
 * @param entries Array of { key, value } to upsert. value MUST NOT contain a newline.
 */
export function upsertEnvLocal(entries) {
  if (!entries.length) return [];
  const lines = [];
  if (exists(ENV_PATH)) {
    lines.push(...readFileSync(ENV_PATH, "utf8").split(/\r?\n/));
  }

  const written = [];
  for (const { key, value } of entries) {
    if (value === undefined || value === null || value === "") {
      written.push({ key, written: false, reason: "empty" });
      continue;
    }
    if (value.includes("\n")) {
      written.push({ key, written: false, reason: "contains newline" });
      continue;
    }
    const re = new RegExp(`^\\s*${escapeRegExp(key)}=.*$`);
    const idx = lines.findIndex((l) => re.test(l));
    const line = `${key}=${value}`;
    if (idx >= 0) {
      lines[idx] = line;
    } else {
      lines.push(line);
    }
    written.push({ key, written: true });
  }

  if (written.some((w) => w.written)) {
    writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf8");
  }
  return written;
}

function exists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}