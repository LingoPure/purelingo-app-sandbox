#!/usr/bin/env node
// scripts/invite-investor.mjs — operator-run investor provisioning (Phase 3).
//
// Investor access is invite-only. This creates/ensures the auth user, upserts
// the investors row, and (unless --password is given) prints a magic sign-in
// link. Run by the operator; never self-serve signup.
//
//   node scripts/invite-investor.mjs --email a@firm.com --name "Jane" --firm "Acme VC"
//   node scripts/invite-investor.mjs --email qa@... --password "<pw>" --tier main   # QA account
//   node scripts/invite-investor.mjs --email a@firm.com --tier restricted           # pre-grant deep dive
//
// Flags: --email (required) --name --firm --tier main|restricted (default main)
//        --password (set a password instead of magic-link) --site <app origin>
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local).

import { createClient } from '@supabase/supabase-js';
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

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return process.argv.includes(`--${name}`) ? true : def;
}

const email = arg('email');
const fullName = arg('name', null);
const firm = arg('firm', null);
const tier = arg('tier', 'main');
const password = arg('password', null);
const site = arg('site', process.env.NEXT_PUBLIC_SITE_URL || 'https://lingo-pure-ai.vercel.app');

if (!email) { console.error('Missing --email'); process.exit(1); }
if (!['main', 'restricted'].includes(tier)) { console.error('--tier must be main|restricted'); process.exit(1); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

async function findUserByEmail(targetEmail) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === targetEmail.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

// 1. Ensure the auth user exists.
let userId;
{
  const create = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(password ? { password } : {}),
  });
  if (create.error) {
    if (/registered|exists/i.test(create.error.message)) {
      const existing = await findUserByEmail(email);
      if (!existing) throw new Error(`user exists but not found via listUsers: ${email}`);
      userId = existing.id;
      if (password) {
        const upd = await sb.auth.admin.updateUserById(userId, { password });
        if (upd.error) throw new Error(`set password failed: ${upd.error.message}`);
      }
      console.log(`= auth user already existed: ${userId}`);
    } else {
      throw new Error(`createUser failed: ${create.error.message}`);
    }
  } else {
    userId = create.data.user.id;
    console.log(`+ auth user created: ${userId}`);
  }
}

// 2. Upsert the investors row.
{
  const { error } = await sb.from('investors').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      firm,
      max_tier: tier,
      status: 'active',
      invited_by: 'operator',
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(`investors upsert failed: ${error.message}`);
  console.log(`+ investors row upserted (tier=${tier}, status=active)`);
}

// 3. Sign-in path.
if (password) {
  console.log(`\n✔ ${email} can sign in with the password you set at ${site}/investor/login`);
} else {
  const link = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${site}/auth/callback?next=/investor/ask` },
  });
  if (link.error) throw new Error(`generateLink failed: ${link.error.message}`);
  const actionLink = link.data?.properties?.action_link;
  console.log(`\n✔ Invite ready for ${email}. Send them this one-time sign-in link:\n`);
  console.log(actionLink);
  console.log(`\n(They land at ${site}/investor/ask. ${tier === 'main' ? 'They can unlock deep dive via the in-portal NDA.' : 'Deep-dive access pre-granted.'})`);
}
