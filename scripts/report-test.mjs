// Proves the Phase-4 engine: per-section retrieve+synthesise on the live index +
// pdf-lib watermarked render. Mirrors build-report.ts + report-pdf.ts. Writes a
// real PDF to the scratchpad. No HTTP/auth layer.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const raw of existsSync(path.join(REPO,'.env.local'))?readFileSync(path.join(REPO,'.env.local'),'utf8').split(/\r?\n/):[]) {
  const l=raw.trim(); if(!l||l.startsWith('#'))continue; const i=l.indexOf('='); if(i<0)continue;
  const k=l.slice(0,i).trim(); let v=l.slice(i+1).trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  if(!(k in process.env))process.env[k]=v;
}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
const tiers=['main','restricted'];
const SECTIONS=['Revenue model','Unit economics','Cap table'];
const SYS=`You are the LingoPure investor analyst drafting ONE report section using ONLY the excerpts. Cite claims as [Document, p.N]. If not covered, reply exactly "Not covered in the available dataroom." Plain text, concise.`;
async function section(h){
  const e=(await openai.embeddings.create({model:'text-embedding-3-large',input:h,dimensions:1536})).data[0].embedding;
  const {data}=await sb.rpc('match_dataroom_chunks',{query_embedding:e,allowed_tiers:tiers,match_count:8});
  if(!data||!data.length)return {h,body:'Not covered in the available dataroom.',n:0};
  const ctx=data.map((c,i)=>`[${i+1}] (${c.display_name}${c.page?', p.'+c.page:''})\n${c.content}`).join('\n\n');
  const r=await anthropic.messages.create({model:'claude-sonnet-4-6',max_tokens:1000,system:SYS,messages:[{role:'user',content:`Section: ${h}\n\nExcerpts:\n\n${ctx}\n\n---\nWrite "${h}".`}]});
  return {h,body:r.content.find(b=>b.type==='text')?.text?.trim()||'(empty)',n:data.length};
}
const built=await Promise.all(SECTIONS.map(section));
let md=`# LingoPure - Financials brief\n\n`;
for(const s of built){ md+=`## ${s.h}\n\n${s.body}\n\n`; console.log(`§ ${s.h}: ${s.n} sources, ${s.body.length} chars ${s.body.startsWith('Not covered')?'(NOT COVERED)':''}`); }
// minimal watermarked render
const wa=t=>t.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/•/g,'-').replace(/[^\x09\x0A\x0D\x20-\xFF]/g,'');
const pdf=await PDFDocument.create(); const font=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
const W=595.28,H=841.89,m=56; let pg=pdf.addPage([W,H]); let y=H-m;
const wrap=(t,f,s)=>{const o=[];for(const ln of wa(t).split('\n')){if(!ln.trim()){o.push('');continue;}const w=ln.split(/\s+/);let c='';for(const x of w){const tr=c?c+' '+x:x;if(f.widthOfTextAtSize(tr,s)>W-m*2&&c){o.push(c);c=x;}else c=tr;}if(c)o.push(c);}return o;};
const draw=(t,f,s,col)=>{for(const ln of wrap(t,f,s)){if(!ln){y-=s*0.6;continue;}if(y-s*1.35<m+36){pg=pdf.addPage([W,H]);y=H-m;}pg.drawText(ln,{x:m,y,size:s,font:f,color:col});y-=s*1.35;}y-=4;};
for(const ln of md.split('\n')){const t=ln.trimEnd();if(t.startsWith('# '))draw(t.slice(2),bold,20,rgb(0.06,0.09,0.16));else if(t.startsWith('## ')){y-=6;draw(t.slice(3),bold,13,rgb(0.72,0.55,0.2));}else if(t.startsWith('- '))draw('-  '+t.slice(2),font,10.5,rgb(0.06,0.09,0.16));else if(!t.trim())y-=5;else draw(t,font,10.5,rgb(0.06,0.09,0.16));}
for(const[i,p]of pdf.getPages().entries()){p.drawText('CONFIDENTIAL',{x:90,y:360,size:64,font:bold,color:rgb(0.55,0.58,0.66),rotate:degrees(45),opacity:0.1});p.drawText('Confidential - prepared for QA Capital  -  2026-06-25',{x:m,y:30,size:8,font,color:rgb(0.45,0.45,0.5)});p.drawText(`${i+1} / ${pdf.getPageCount()}`,{x:W-m-36,y:30,size:8,font,color:rgb(0.45,0.45,0.5)});}
const bytes=await pdf.save();
const out=path.join(process.env.TEMP||'/tmp','lingopure-report-test.pdf');
writeFileSync(out,Buffer.from(bytes));
const head=Buffer.from(bytes.slice(0,5)).toString();
console.log(`\nPDF: ${pdf.getPageCount()} pages, ${bytes.length} bytes, header="${head}" ${head==='%PDF-'?'VALID':'INVALID'}`);
console.log('wrote',out);
