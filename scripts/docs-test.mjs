// Proves the documents path: fetch a stored original from the bucket + stamp a PDF.
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const raw of existsSync(path.join(REPO,'.env.local'))?readFileSync(path.join(REPO,'.env.local'),'utf8').split(/\r?\n/):[]){const l=raw.trim();if(!l||l.startsWith('#'))continue;const i=l.indexOf('=');if(i<0)continue;const k=l.slice(0,i).trim();let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!(k in process.env))process.env[k]=v;}
const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function stamp(bytes){const pdf=await PDFDocument.load(bytes,{ignoreEncryption:true});const bold=await pdf.embedFont(StandardFonts.HelveticaBold);for(const p of pdf.getPages())p.drawText('CONFIDENTIAL',{x:80,y:320,size:58,font:bold,color:rgb(0.55,0.58,0.66),rotate:degrees(45),opacity:0.1});return {bytes:await pdf.save(),pages:pdf.getPageCount()};}
const pdfDoc=(await sb.from('dataroom_documents').select('id,display_name,storage_path,format').eq('format','pdf').not('storage_path','is',null).limit(1)).data[0];
const imgDoc=(await sb.from('dataroom_documents').select('id,display_name,storage_path,format').in('format',['png','jpeg']).not('storage_path','is',null).limit(1)).data[0];
for(const [label,doc] of [['PDF',pdfDoc],['IMAGE',imgDoc]]){
  const dl=await sb.storage.from('dataroom').download(doc.storage_path);
  if(dl.error){console.log(`❌ ${label} download: ${dl.error.message}`);continue;}
  const raw=new Uint8Array(await dl.data.arrayBuffer());
  if(doc.format==='pdf'){const s=await stamp(raw);const ok=Buffer.from(s.bytes.slice(0,5)).toString()==='%PDF-';console.log(`${ok?'✅':'❌'} ${label} "${doc.display_name.slice(0,40)}": fetched ${raw.length}b → stamped ${s.bytes.length}b, ${s.pages}pp`);}
  else console.log(`✅ ${label} "${doc.display_name.slice(0,40)}": fetched ${raw.length}b (${doc.format}, served as-is)`);
}
