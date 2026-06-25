#!/usr/bin/env node
// scripts/answer-test.mjs — proves the Phase-2 answer core (retrieve → cited
// answer) against the live index, without the HTTP/auth layer. Mirrors
// src/lib/investor/answer.ts. Usage: node scripts/answer-test.mjs "question"
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const raw of existsSync(path.join(REPO, '.env.local')) ? readFileSync(path.join(REPO, '.env.local'), 'utf8').split(/\r?\n/) : []) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  const k = l.slice(0, i).trim(); let v = l.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the LingoPure investor analyst. Answer ONLY from the provided dataroom excerpts. Cite every factual claim inline as [Document name, p.N]. If the excerpts do not contain the answer, say so plainly and name the closest document; never fabricate a figure. Lead with the answer. Do not allude to documents outside the excerpts.`;

const question = process.argv[2] || 'What is the cap table and ESOP allocation, and the headline revenue projection?';
const tiers = (process.argv[3] || 'main').split(',');

const emb = (await openai.embeddings.create({ model: 'text-embedding-3-large', input: question, dimensions: 1536 })).data[0].embedding;
const { data: chunks, error } = await svc.rpc('match_dataroom_chunks', { query_embedding: emb, allowed_tiers: tiers, match_count: 12 });
if (error) { console.error('retrieval error:', error.message); process.exitCode = 1; }
else {
  const context = chunks.map((c, i) => `[${i + 1}] (${c.display_name}${c.page ? ', p.' + c.page : ''})\n${c.content}`).join('\n\n');
  const r = await anthropic.messages.create({
    model: process.env.INVESTOR_ANSWER_MODEL || 'claude-sonnet-4-6',
    max_tokens: 1500, system: SYSTEM,
    messages: [{ role: 'user', content: `Dataroom excerpts:\n\n${context}\n\n---\nInvestor question: ${question}` }],
  });
  const answer = r.content.find((b) => b.type === 'text')?.text ?? '';
  console.log(`Q [${tiers}]: ${question}\n`);
  console.log('ANSWER:\n' + answer + '\n');
  const docs = [...new Set(chunks.map((c) => c.display_name))];
  console.log('Sources consulted:', docs.slice(0, 8).join(' | '));
}
