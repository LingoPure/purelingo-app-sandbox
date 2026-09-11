/**
 * LingoPure 2K — Parse canonical data banks from Dan's Master HTML files
 * into versioned JSON seed files ready for Supabase loading.
 *
 * Run: node scripts/extract-databanks.mjs
 *
 * Input:
 *   docs/LingoPure_Technology_Dan_Docs/LingoPure Technology/
 *     LingoPure_LP18_Master_Brain_Web_v6.1_Live_Governed_Audio_Integrated (1).html
 *     LingoPure_LP18_Recommendation_Data_Bank_v6_Audio_Integrated_Master_Bank.html
 *
 * Output:
 *   data-banks/
 *     lp_rec_db.json              (1,080 diagnostic seeds)
 *     interventions.json          (432 canonical A-I interventions)
 *     system_laws.json            (18 immutable governance laws)
 *     score_bands.json            (6 score bands)
 *     trajectory_moments.json     (6 trajectory moments)
 *     confidence_tiers.json       (4 confidence tiers)
 *     prior_responses.json        (5 prior-response modifiers)
 *     j_subtypes.json             (9 J-family sub-type maps)
 *     audio_examples.json         (7,200 audio utterance bank — ISS-020)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs", "LingoPure_Technology_Dan_Docs");
const MB_HTML = path.join(DOCS, "LingoPure Technology", "LingoPure_LP18_Master_Brain_Web_v6.1_Live_Governed_Audio_Integrated (1).html");
const RB_HTML = path.join(DOCS, "LingoPure Technology", "LingoPure_LP18_Recommendation_Data_Bank_v6_Audio_Integrated_Master_Bank.html");
const OUT = path.join(ROOT, "data-banks");

// Ensure output dir exists
fs.mkdirSync(OUT, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Extract a const = [...] or const = {...} from an HTML file by name.
 * Uses Function() to evaluate the JS snippet safely (no browser env needed).
 */
function extractFromHtml(html, varName) {
  // Find "const varName=" or "var varName=" or "let varName="
  const pattern = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=`);
  const match = html.match(pattern);
  if (!match) {
    console.error(`  [WARN] ${varName} not found in HTML`);
    return null;
  }
  const startIdx = html.indexOf("=", match.index) + 1;

  // Find matching end by bracket counting
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;
  const isArray = html[startIdx + html.slice(startIdx).match(/^\s*/)[0].length] === "[";
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  let endIdx = startIdx;

  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === openBracket) depth++;
    if (ch === closeBracket) {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  const snippet = html.slice(match.index, endIdx);
  // Evaluate via Function (no DOM access, just data literals)
  try {
    const fn = new Function(`return (${snippet.replace(/^.*?=\s*/, "")})`);
    return fn();
  } catch (err) {
    console.error(`  [ERROR] Failed to evaluate ${varName}: ${err.message}`);
    return null;
  }
}

function writeJson(name, data) {
  const filePath = path.join(OUT, name);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  const count = Array.isArray(data) ? data.length : Object.keys(data).length;
  console.log(`  ✅ ${name} — ${count} entries → ${filePath}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

console.log("LingoPure 2K — Canonical Data Bank Extraction");
console.log("────────────────────────────────────────────────\n");

// 1. Read HTML files
console.log("Reading HTML files...");
const mbHtml = fs.readFileSync(MB_HTML, "utf-8");
const rbHtml = fs.readFileSync(RB_HTML, "utf-8");
console.log(`  Master Brain:  ${(mbHtml.length / 1e6).toFixed(1)} MB`);
console.log(`  Rec Data Bank: ${(rbHtml.length / 1e6).toFixed(1)} MB\n`);

// 2. Extract from Master Brain
console.log("Extracting from Master Brain HTML...");

const lpRecDb = extractFromHtml(mbHtml, "LP_REC_DB");
if (lpRecDb) writeJson("lp_rec_db.json", lpRecDb);

const assessmentLayers = extractFromHtml(mbHtml, "ASSESSMENT_LAYERS");
if (assessmentLayers) writeJson("assessment_layers.json", assessmentLayers);

const d6Base = extractFromHtml(mbHtml, "D6_BASE");
if (d6Base) writeJson("d6_base.json", d6Base);

const levels = extractFromHtml(mbHtml, "LEVELS");
if (levels) writeJson("levels.json", levels);

const q25 = extractFromHtml(mbHtml, "Q25");
if (q25) writeJson("q25_rich.json", q25);

const lpRecV2ScoreBands = extractFromHtml(mbHtml, "LP_REC_V2_SCORE_BANDS");
if (lpRecV2ScoreBands) writeJson("lp_rec_v2_score_bands.json", lpRecV2ScoreBands);

const tele = extractFromHtml(mbHtml, "TELE");
if (tele) writeJson("tele.json", tele);

const d6Tels = extractFromHtml(mbHtml, "D6_TELS");
if (d6Tels) writeJson("d6_tels.json", d6Tels);

const localScenarios = extractFromHtml(mbHtml, "LOCAL_SCENARIOS");
if (localScenarios) writeJson("local_scenarios.json", localScenarios);

console.log("");

// 3. Extract from Recommendation Data Bank
console.log("Extracting from Recommendation Data Bank HTML...");

const control = extractFromHtml(rbHtml, "CONTROL");
if (control) {
  if (control.canonical) writeJson("interventions.json", control.canonical);
  if (control.scoreBands) writeJson("score_bands.json", control.scoreBands);
  if (control.moments) writeJson("trajectory_moments.json", control.moments);
  if (control.confidence) writeJson("confidence_tiers.json", control.confidence);
  if (control.responses) writeJson("prior_responses.json", control.responses);
}

const jSubtype = extractFromHtml(rbHtml, "J_SUBTYPE");
if (jSubtype) writeJson("j_subtypes.json", jSubtype);

const systemLaws = extractFromHtml(rbHtml, "SYSTEM_LAWS");
if (systemLaws) writeJson("system_laws.json", systemLaws);

const audioExamples = extractFromHtml(rbHtml, "AUDIO_EXAMPLES");
if (audioExamples) writeJson("audio_examples.json", audioExamples);

// 4. Summary
console.log("\n────────────────────────────────────────────────");
console.log("Extraction complete. Files in data-banks/ directory.");

const totalSeeds = lpRecDb?.length ?? 0;
const totalInterventions = control?.canonical?.length ?? 0;
const totalJSubtypes = jSubtype ? Object.keys(jSubtype).length : 0;
const totalLaws = systemLaws?.length ?? 0;
const totalAudioExamples = audioExamples?.length ?? 0;

console.log(`\nTotals:`);
console.log(`  Diagnostic seeds:   ${totalSeeds.toLocaleString()}`);
console.log(`  Interventions:      ${totalInterventions.toLocaleString()}`);
console.log(`  J sub-types:        ${totalJSubtypes}`);
console.log(`  System laws:        ${totalLaws}`);
console.log(`  Audio examples:     ${totalAudioExamples.toLocaleString()}`);
console.log(`  Grand total:        ${(totalSeeds + totalInterventions + totalJSubtypes + totalLaws + totalAudioExamples).toLocaleString()} rows`);
