// Phase-3 verification: investor provisioning → NDA accept → tier escalation →
// restricted retrieval unlocked. Uses a throwaway investor, cleaned up at the end.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const raw of existsSync(path.join(REPO,'.env.local'))?readFileSync(path.join(REPO,'.env.local'),'utf8').split(/\r?\n/):[]) {
  const l=raw.trim(); if(!l||l.startsWith('#'))continue; const i=l.indexOf('='); if(i<0)continue;
  const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(!(k in process.env))process.env[k]=v;
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const NDA_VERSION = '2026-06';
const DEEP_Q = 'What is the financial doctrine and governance-to-intelligence cost summary from the board IC?';
const ok = (c,m)=>console.log(`${c?'✅':'❌'} ${m}`);
let pass = true; const check=(c,m)=>{ if(!c)pass=false; ok(c,m); };

async function retrieve(tiers){
  const e=(await openai.embeddings.create({model:'text-embedding-3-large',input:DEEP_Q,dimensions:1536})).data[0].embedding;
  const {data,error}=await sb.rpc('match_dataroom_chunks',{query_embedding:e,allowed_tiers:tiers,match_count:6});
  if(error)throw new Error(error.message); return data;
}

const email = 'dennis+ndatest@factory2key.com.au';
let userId;
try {
  const c = await sb.auth.admin.createUser({ email, email_confirm:true });
  userId = c.data?.user?.id;
  if(!userId){ const list=await sb.auth.admin.listUsers({perPage:200}); userId=list.data.users.find(u=>u.email===email)?.id; }
  await sb.from('investors').upsert({ id:userId, email, full_name:'NDA Test', firm:'Test', max_tier:'main', status:'active', invited_by:'phase3-verify' },{onConflict:'id'});

  // 1. starts main
  let row=(await sb.from('investors').select('max_tier,nda_accepted_at').eq('id',userId).single()).data;
  check(row.max_tier==='main' && !row.nda_accepted_at, `provisioned as main, no NDA (max_tier=${row.max_tier})`);

  // 2. pre-accept: main-only retrieval must NOT return restricted
  const pre = await retrieve(['main']);
  check(!pre.some(h=>h.confidentiality_tier==='restricted'), `pre-accept main-only retrieval has NO restricted leak (${pre.length} hits)`);

  // 3. simulate the accept route's mutations
  await sb.from('investor_nda_acceptances').insert({ investor_id:userId, nda_version:NDA_VERSION, signer_name:'NDA Test', ip_address:'127.0.0.1', user_agent:'phase3-verify' });
  await sb.from('investors').update({ max_tier:'restricted', nda_accepted_at:new Date().toISOString(), nda_version:NDA_VERSION, nda_signer_name:'NDA Test' }).eq('id',userId);
  await sb.from('dataroom_audit').insert({ investor_id:userId, action:'nda_accept', detail:{nda_version:NDA_VERSION} });

  // 4. tier flipped + ledger recorded
  row=(await sb.from('investors').select('max_tier,nda_accepted_at,nda_version').eq('id',userId).single()).data;
  check(row.max_tier==='restricted' && !!row.nda_accepted_at && row.nda_version===NDA_VERSION, `after accept: max_tier=restricted, nda recorded (v${row.nda_version})`);
  const led=(await sb.from('investor_nda_acceptances').select('id',{count:'exact',head:true}).eq('investor_id',userId)).count;
  check(led>=1, `acceptance ledger row written (count=${led})`);

  // 5. post-accept: deep-dive retrieval now returns restricted
  const post = await retrieve(['main','restricted']);
  check(post.some(h=>h.confidentiality_tier==='restricted'), `post-accept retrieval returns restricted (top: ${post[0]?.display_name} [${post[0]?.confidentiality_tier}])`);

  // 6. audit trail present
  const aud=(await sb.from('dataroom_audit').select('action').eq('investor_id',userId)).data.map(a=>a.action);
  check(aud.includes('nda_accept'), `audit has nda_accept (actions: ${aud.join(',')})`);
} finally {
  if(userId){ await sb.auth.admin.deleteUser(userId); const gone=(await sb.from('investors').select('id',{count:'exact',head:true}).eq('id',userId)).count; ok(gone===0, `cleanup: throwaway investor deleted (cascade), remaining=${gone}`); }
}
console.log(pass?'\nPHASE 3 FLOW: ALL CHECKS PASSED':'\nPHASE 3 FLOW: FAILURES ABOVE');
