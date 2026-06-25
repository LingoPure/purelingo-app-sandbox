#!/usr/bin/env node
// scripts/retrieval-test.mjs — Phase-1 dataroom retrieval smoke test.
// Verifies the index is queryable and the NDA/tier gate holds.
//   node scripts/retrieval-test.mjs
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const p = path.join(REPO, '.env.local');
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('='); if (i < 0) continue;
    const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embed(q) {
  const r = await openai.embeddings.create({ model: 'text-embedding-3-large', input: q, dimensions: 1536 });
  return r.data[0].embedding;
}
async function retrieve(q, tiers, n = 5) {
  const { data, error } = await supabase.rpc('match_dataroom_chunks', { query_embedding: await embed(q), allowed_tiers: tiers, match_count: n });
  if (error) throw new Error(error.message);
  return data;
}

const docs = await supabase.from('dataroom_documents').select('confidentiality_tier');
const chunks = await supabase.from('dataroom_chunks').select('id', { count: 'exact', head: true });
const byTier = (docs.data || []).reduce((a, d) => ((a[d.confidentiality_tier] = (a[d.confidentiality_tier] || 0) + 1), a), {});
console.log('=== INDEX STATE ===');
console.log('documents:', docs.data?.length, 'by tier:', JSON.stringify(byTier), '| chunks:', chunks.count);

const questions = [
  { q: 'What is the cap table and ESOP allocation?', tiers: ['main'] },
  { q: 'What does the LP-1000 telemetry dashboard visualize?', tiers: ['main'] },
  { q: 'What are the revenue projections and scaling plan?', tiers: ['main'] },
];
for (const { q, tiers } of questions) {
  console.log(`\n=== Q: ${q}  [tiers=${tiers}] ===`);
  for (const h of await retrieve(q, tiers, 4)) {
    console.log(`  ${h.similarity.toFixed(3)}  ${h.display_name}${h.page ? ' p.' + h.page : ''}${h.is_vision_caption ? ' [vision]' : ''} [${h.confidentiality_tier}]`);
    console.log(`     ${h.content.replace(/\s+/g, ' ').slice(0, 140)}…`);
  }
}

const gq = 'What is the financial doctrine and governance-to-intelligence cost summary from the board IC?';
console.log(`\n=== TIER GATE TEST ===\nQ: ${gq}`);
const mainOnly = await retrieve(gq, ['main'], 5);
const both = await retrieve(gq, ['main', 'restricted'], 5);
console.log(`main-only: ${mainOnly.length} hits | restricted leaked? ${mainOnly.some((h) => h.confidentiality_tier === 'restricted')}`);
console.log('  top:', mainOnly.slice(0, 3).map((h) => `${h.display_name}[${h.confidentiality_tier}]`).join(' | '));
console.log(`main+restricted: ${both.length} hits | includes restricted? ${both.some((h) => h.confidentiality_tier === 'restricted')}`);
console.log('  top:', both.slice(0, 3).map((h) => `${h.display_name}[${h.confidentiality_tier}]`).join(' | '));
