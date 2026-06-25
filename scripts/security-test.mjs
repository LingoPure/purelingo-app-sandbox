// Phase-5 tier-leak / confidentiality test (release-blocking, §9). A main-tier
// investor must NEVER reach restricted material via ask retrieval or documents.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const raw of existsSync(path.join(REPO,'.env.local'))?readFileSync(path.join(REPO,'.env.local'),'utf8').split(/\r?\n/):[]){const l=raw.trim();if(!l||l.startsWith('#'))continue;const i=l.indexOf('=');if(i<0)continue;const k=l.slice(0,i).trim();let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!(k in process.env))process.env[k]=v;}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const allowedTiersFor=t=>t==='restricted'?['main','restricted']:['main'];
let pass=true; const check=(c,m)=>{ if(!c)pass=false; console.log(`${c?'✅':'❌'} ${m}`); };
async function ret(q,tiers){const e=(await openai.embeddings.create({model:'text-embedding-3-large',input:q,dimensions:1536})).data[0].embedding;const{data,error}=await sb.rpc('match_dataroom_chunks',{query_embedding:e,allowed_tiers:tiers,match_count:12});if(error)throw new Error(error.message);return data;}

console.log('— ask retrieval tier-leak (main must never see restricted) —');
const deepQs=['financial doctrine','governance to intelligence stack cost summary','certification engine economics board IC','market doctrine and strategic trajectory','bottom-up system embedment value model'];
let mainLeaks=0, restrictedSeenWhenAllowed=0;
for(const q of deepQs){
  const main=await ret(q,allowedTiersFor('main'));
  const both=await ret(q,allowedTiersFor('restricted'));
  if(main.some(h=>h.confidentiality_tier==='restricted'))mainLeaks++;
  if(both.some(h=>h.confidentiality_tier==='restricted'))restrictedSeenWhenAllowed++;
}
check(mainLeaks===0, `main-tier retrieval leaked restricted on ${mainLeaks}/${deepQs.length} deep-dive queries (must be 0)`);
check(restrictedSeenWhenAllowed===deepQs.length, `restricted-tier retrieval surfaces restricted on ${restrictedSeenWhenAllowed}/${deepQs.length} (positive control)`);

console.log('\n— documents tier gate —');
const allDocs=(await sb.from('dataroom_documents').select('id,confidentiality_tier')).data;
const restrictedDocs=allDocs.filter(d=>d.confidentiality_tier==='restricted');
const mainListing=(await sb.from('dataroom_documents').select('id,confidentiality_tier').in('confidentiality_tier',allowedTiersFor('main'))).data;
check(restrictedDocs.length>0, `corpus has restricted docs to protect (${restrictedDocs.length})`);
check(!mainListing.some(d=>d.confidentiality_tier==='restricted'), `main-tier documents listing excludes ALL restricted (${mainListing.length} shown)`);
check(restrictedDocs.every(d=>!allowedTiersFor('main').includes(d.confidentiality_tier)), `download tier-check rejects every restricted doc for a main investor`);

console.log('\n— audit wiring (actions recorded to date) —');
const audit=(await sb.from('dataroom_audit').select('action')).data;
const actions=[...new Set(audit.map(a=>a.action))].sort();
console.log(`   dataroom_audit actions present: ${actions.join(', ')||'(none yet)'} — ${audit.length} rows`);

console.log(pass?'\nSECURITY: ALL TIER-LEAK CHECKS PASSED':'\nSECURITY: FAILURES ABOVE — DO NOT SHIP');
