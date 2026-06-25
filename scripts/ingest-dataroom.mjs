#!/usr/bin/env node
// scripts/ingest-dataroom.mjs
// ───────────────────────────────────────────────────────────────────────────
// Investor dataroom ingestion (Phase 1).
//
// Walks docs/LingoPure main documents (tier=main) and docs/LP Deep Dive
// Documents (tier=restricted), and for each file:
//   1. classifies tier + category
//   2. extracts text  (pdf | docx | xlsx)  OR  vision-captions  (png | jpeg)
//   3. chunks the text  (~800 tokens, ~120 overlap, page-aware for PDFs)
//   4. embeds each chunk  (OpenAI text-embedding-3-large @ 1536 dims)
//   5. uploads the original file to the private 'dataroom' Storage bucket
//   6. upserts dataroom_documents + dataroom_chunks  (idempotent via content_hash)
//
// Idempotent: a file whose SHA-256 is unchanged since last run is skipped.
// No silent drops: any parse/caption failure is reported in the run summary.
//
// Run:
//   node scripts/ingest-dataroom.mjs            # full corpus
//   node scripts/ingest-dataroom.mjs --only "*Pitch*"   # one glob, re-ingest
//   node scripts/ingest-dataroom.mjs --dry-run  # parse+chunk+caption, no DB writes
//
// Requires (already in LingoPure, no new keys): NEXT_PUBLIC_SUPABASE_URL,
//   SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY.
// New deps: mammoth, xlsx, pdf-parse  (npm install mammoth xlsx pdf-parse).
// ───────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── paths ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.join(REPO_ROOT, 'docs');
const SOURCES = [
  { dir: path.join(DOCS_ROOT, 'LingoPure main documents'), tier: 'main' },
  { dir: path.join(DOCS_ROOT, 'LP Deep Dive Documents'), tier: 'restricted' },
];

// ── config ────────────────────────────────────────────────────────────────
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const EMBEDDING_DIMS = 1536; // must match the vector(1536) column in 0020
const VISION_MODEL = process.env.VISION_MODEL || 'claude-sonnet-4-6';
const BUCKET = 'dataroom';
const CHUNK_CHARS = 3200; // ~800 tokens
const CHUNK_OVERLAP = 480; // ~120 tokens
const EMBED_BATCH = 64;

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const ONLY = (() => {
  const i = argv.indexOf('--only');
  return i >= 0 ? argv[i + 1] : null;
})();

// ── minimal .env.local loader (standalone script — Next doesn't load it) ────
function loadEnvLocal() {
  const envPath = path.join(REPO_ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

function requireEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!OPENAI_KEY) missing.push('OPENAI_API_KEY');
  if (!ANTHROPIC_KEY) missing.push('ANTHROPIC_API_KEY');
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
}
requireEnv();

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});
const openai = new OpenAI({ apiKey: OPENAI_KEY });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ── classification ──────────────────────────────────────────────────────────
const CATEGORY_RULES = [
  { rx: /financ|cap.?table|esop|model|revenue|projection|unit.?econ|doctrine|cost/i, cat: 'financial' },
  { rx: /legal|contract|agreement|nda|msa|sow|terms|constitution|licence|license|deed|equity/i, cat: 'legal' },
  { rx: /tech|architect|telemetry|roadmap|protocol|stack|governance|integrity|system|diagram|lp.?1000/i, cat: 'tech' },
  { rx: /gtm|go.?to.?market|marketing|pitch|one.?pager|deck|case.?study/i, cat: 'gtm' },
  { rx: /market|trajectory|strateg|tam|competit/i, cat: 'market' },
  { rx: /team|founder|advisor|director|board/i, cat: 'team' },
  { rx: /cefr|framework|curriculum|lesson|level/i, cat: 'cefr' },
  { rx: /review|testimonial|customer/i, cat: 'reviews' },
];
function classifyCategory(relPath) {
  for (const { rx, cat } of CATEGORY_RULES) if (rx.test(relPath)) return cat;
  return 'other';
}

const FORMATS = {
  '.pdf': 'pdf', '.docx': 'docx', '.xlsx': 'xlsx',
  '.png': 'png', '.jpeg': 'jpeg', '.jpg': 'jpeg',
};
function formatOf(file) {
  return FORMATS[path.extname(file).toLowerCase()] || null;
}

// ── walk ──────────────────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// ── extraction ──────────────────────────────────────────────────────────────
// Returns [{ page, text }]  (page null when the format has no pages).
async function extractText(absPath, format) {
  if (format === 'docx') {
    const { value } = await mammoth.extractRawText({ path: absPath });
    return [{ page: null, text: value || '' }];
  }
  if (format === 'xlsx') {
    const wb = XLSX.read(readFileSync(absPath), { type: 'buffer' });
    const parts = [];
    for (const sheet of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false });
      const lines = rows
        .map((r) => r.map((c) => (c == null ? '' : String(c))).join(' | '))
        .filter((l) => l.replace(/\|/g, '').trim().length > 0);
      if (lines.length) parts.push(`Sheet: ${sheet}\n${lines.join('\n')}`);
    }
    return [{ page: null, text: parts.join('\n\n') }];
  }
  if (format === 'pdf') {
    // pdf-parse v2: per-page text directly (page-accurate for citations).
    const parser = new PDFParse({ data: readFileSync(absPath) });
    try {
      const r = await parser.getText();
      return (r.pages || []).map((p) => ({ page: p.num ?? null, text: p.text || '' }));
    } finally {
      await parser.destroy?.();
    }
  }
  throw new Error(`extractText: unsupported format ${format}`);
}

// Small retry wrapper for transient network blips on the LLM/embedding APIs.
async function withRetry(fn, label, tries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === tries) break;
      const wait = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      console.warn(`  retry ${attempt}/${tries - 1} (${label}): ${err.message} — waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const MEDIA_TYPE = { png: 'image/png', jpeg: 'image/jpeg' };
const VISION_PROMPT =
  'You are cataloguing an investor-dataroom diagram for a searchable index. ' +
  'Describe this image precisely and factually: what it shows, the type of chart/diagram, ' +
  'every axis label, legend, series name, and any numbers or units visible, and the single ' +
  'claim or takeaway it is making. If it is a screenshot of a dashboard or document, transcribe ' +
  'the key text and figures. Do not speculate beyond what is visible. Write 1–3 dense paragraphs.';

async function captionImage(absPath, format) {
  const data = readFileSync(absPath).toString('base64');
  const resp = await withRetry(() => anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: MEDIA_TYPE[format], data } },
        { type: 'text', text: VISION_PROMPT },
      ],
    }],
  }), `vision ${path.basename(absPath)}`);
  return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

// ── chunking ────────────────────────────────────────────────────────────────
// Page-aware: never merges text across PDF page boundaries (keeps citations accurate).
function chunkPages(pages) {
  const chunks = [];
  for (const { page, text } of pages) {
    const clean = (text || '').replace(/\s+\n/g, '\n').trim();
    if (!clean) continue;
    if (clean.length <= CHUNK_CHARS) {
      chunks.push({ page, content: clean });
      continue;
    }
    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + CHUNK_CHARS, clean.length);
      chunks.push({ page, content: clean.slice(start, end).trim() });
      if (end >= clean.length) break;
      start = end - CHUNK_OVERLAP;
    }
  }
  return chunks.filter((c) => c.content.length > 0);
}

// ── embeddings ──────────────────────────────────────────────────────────────
async function embedAll(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const resp = await withRetry(() => openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMS,
    }), `embed batch ${i / EMBED_BATCH}`);
    for (const d of resp.data) vectors.push(d.embedding);
  }
  return vectors;
}

// ── persistence ─────────────────────────────────────────────────────────────
// Supabase Storage rejects non-ASCII / unicode-dash chars in object keys.
// Build an ASCII-safe key (folder structure preserved); the readable original
// stays in dataroom_documents.source_file. An 8-char hash guarantees uniqueness
// even if two names sanitize to the same string.
function safeStorageKey(tier, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const base = relPath.slice(0, relPath.length - ext.length);
  const ALLOWED = /[A-Za-z0-9/ ._()-]/;
  const norm = base
    .normalize('NFKD')
    .split('')
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 0x0300 && c <= 0x036f) return '';   // combining diacritics → drop
      if (c >= 0x2010 && c <= 0x2015) return '-';  // unicode en/em dashes → -
      return ALLOWED.test(ch) ? ch : '_';          // anything else → _
    })
    .join('')
    .replace(/_+/g, '_');
  const h = createHash('sha1').update(`${tier}/${relPath}`).digest('hex').slice(0, 8);
  return `${tier}/${norm}-${h}${ext}`.replace(/\\/g, '/');
}

async function uploadOriginal(absPath, tier, relPath) {
  const storagePath = safeStorageKey(tier, relPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, readFileSync(absPath), { upsert: true, contentType: 'application/octet-stream' });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return storagePath;
}

async function upsertDocument(doc) {
  const { data, error } = await supabase
    .from('dataroom_documents')
    .upsert(doc, { onConflict: 'source_file' })
    .select('id')
    .single();
  if (error) throw new Error(`document upsert failed: ${error.message}`);
  return data.id;
}

async function replaceChunks(documentId, tier, chunks, vectors) {
  const del = await supabase.from('dataroom_chunks').delete().eq('document_id', documentId);
  if (del.error) throw new Error(`chunk delete failed: ${del.error.message}`);
  const rows = chunks.map((c, i) => ({
    document_id: documentId,
    confidentiality_tier: tier,
    page: c.page,
    chunk_index: i,
    content: c.content,
    is_vision_caption: !!c.isVisionCaption,
    embedding: vectors[i],
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const ins = await supabase.from('dataroom_chunks').insert(rows.slice(i, i + 200));
    if (ins.error) throw new Error(`chunk insert failed: ${ins.error.message}`);
  }
}

async function existingHash(sourceFile) {
  const { data } = await supabase
    .from('dataroom_documents')
    .select('content_hash')
    .eq('source_file', sourceFile)
    .maybeSingle();
  return data?.content_hash || null;
}

// ── main ────────────────────────────────────────────────────────────────────
function globMatch(pattern, str) {
  const rx = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
  return rx.test(str);
}

async function run() {
  const summary = {
    files: 0, ingested: 0, skipped: 0, chunks: 0, visionCaptioned: 0,
    lowTextPdfs: [], failures: [],
  };

  for (const { dir, tier } of SOURCES) {
    if (!existsSync(dir)) { console.warn(`! source dir missing: ${dir}`); continue; }
    for (const absPath of walk(dir)) {
      const format = formatOf(absPath);
      if (!format) continue;
      const relPath = path.relative(DOCS_ROOT, absPath).replace(/\\/g, '/');
      const baseName = path.basename(absPath);
      if (ONLY && !globMatch(ONLY, baseName)) continue;
      summary.files++;

      try {
        const bytes = readFileSync(absPath);
        const hash = createHash('sha256').update(bytes).digest('hex');

        if (!DRY_RUN && (await existingHash(relPath)) === hash) {
          summary.skipped++;
          console.log(`= skip (unchanged)  ${relPath}`);
          continue;
        }

        const category = classifyCategory(relPath);
        let chunks;
        let pageCount = null;
        let isVision = false;

        if (format === 'png' || format === 'jpeg') {
          const caption = await captionImage(absPath, format);
          if (!caption) throw new Error('vision returned empty caption');
          chunks = [{ page: null, content: caption, isVisionCaption: true }];
          isVision = true;
          summary.visionCaptioned++;
        } else {
          const pages = await extractText(absPath, format);
          if (format === 'pdf') pageCount = pages.length;
          const totalChars = pages.reduce((n, p) => n + (p.text || '').trim().length, 0);
          if (format === 'pdf' && totalChars < 200) {
            // image-only / scanned PDF: pdf-parse found ~no text layer.
            summary.lowTextPdfs.push(relPath);
          }
          chunks = chunkPages(pages);
          if (!chunks.length) {
            summary.lowTextPdfs.push(relPath);
            summary.skipped++;
            console.log(`! no extractable text  ${relPath}`);
            continue;
          }
        }

        const vectors = await embedAll(chunks.map((c) => c.content));
        summary.chunks += chunks.length;

        if (DRY_RUN) {
          console.log(`~ dry-run ${relPath}  [${tier}/${category}/${format}]  chunks=${chunks.length}${isVision ? ' (vision)' : ''}`);
          summary.ingested++;
          continue;
        }

        const storagePath = await uploadOriginal(absPath, tier, relPath);
        const documentId = await upsertDocument({
          source_file: relPath,
          display_name: baseName.replace(/\.[^.]+$/, ''),
          category,
          confidentiality_tier: tier,
          format,
          storage_path: storagePath,
          page_count: pageCount,
          content_hash: hash,
          ingested_at: new Date().toISOString(),
        });
        await replaceChunks(documentId, tier, chunks, vectors);

        summary.ingested++;
        console.log(`+ ${relPath}  [${tier}/${category}/${format}]  chunks=${chunks.length}${isVision ? ' (vision)' : ''}`);
      } catch (err) {
        summary.failures.push({ file: relPath, error: err.message });
        console.error(`✗ FAILED  ${relPath}\n   ${err.message}`);
      }
    }
  }

  console.log('\n──────── ingestion summary ────────');
  console.log(`files seen:        ${summary.files}`);
  console.log(`ingested:          ${summary.ingested}`);
  console.log(`skipped unchanged: ${summary.skipped}`);
  console.log(`total chunks:      ${summary.chunks}`);
  console.log(`vision-captioned:  ${summary.visionCaptioned}`);
  const lowTextUnique = [...new Set(summary.lowTextPdfs)];
  if (lowTextUnique.length) {
    console.log(`\n⚠ PDFs with little/no text layer (likely image-only — need a rendered-page vision pass):`);
    for (const f of lowTextUnique) console.log(`   - ${f}`);
  }
  if (summary.failures.length) {
    console.log(`\n✗ failures (${summary.failures.length}) — NOT silently dropped:`);
    for (const f of summary.failures) console.log(`   - ${f.file}: ${f.error}`);
    process.exitCode = 1;
  }
  console.log('───────────────────────────────────');
}

run().catch((err) => { console.error(err); process.exit(1); });
