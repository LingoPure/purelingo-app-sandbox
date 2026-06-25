#!/usr/bin/env node
// Ensure the canonical admin-AGENT (QA_TEST_ADMIN_EMAIL/PASSWORD from
// cais-shared-services/.secrets/qa-secrets.json) exists as an auth user so the
// operator console (/investor/admin) is testable. It's an OPERATOR (in
// ADMIN_EMAILS) — NOT an investor, so no investors row. Password read from the
// secrets file; never printed.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path"; import { fileURLToPath } from "node:url";
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const raw of existsSync(path.join(R,".env.local"))?readFileSync(path.join(R,".env.local"),"utf8").split(/\r?\n/):[]){const l=raw.trim();if(!l||l.startsWith("#"))continue;const i=l.indexOf("=");if(i<0)continue;const k=l.slice(0,i).trim();let v=l.slice(i+1).trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);if(!(k in process.env))process.env[k]=v;}
const SEC = path.resolve(R,"..","cais-shared-services",".secrets","qa-secrets.json");
const qa = JSON.parse(readFileSync(SEC,"utf8"));
const email = qa.QA_TEST_ADMIN_EMAIL, password = qa.QA_TEST_ADMIN_PASSWORD;
if(!email||!password){console.error("qa-secrets missing QA_TEST_ADMIN_*");process.exit(1);}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
async function findId(e){for(let p=1;p<=10;p++){const{data,error}=await sb.auth.admin.listUsers({page:p,perPage:200});if(error)throw new Error(error.message);const h=data.users.find(u=>(u.email||"").toLowerCase()===e.toLowerCase());if(h)return h.id;if(data.users.length<200)break;}return null;}
const c = await sb.auth.admin.createUser({email,password,email_confirm:true});
if(c.error){ if(/registered|exists/i.test(c.error.message)){const id=await findId(email);if(!id)throw new Error("exists but not found");const u=await sb.auth.admin.updateUserById(id,{password});if(u.error)throw new Error(u.error.message);console.log("= admin-agent existed; password synced");}else throw new Error(c.error.message);} else console.log("+ admin-agent created");
console.log(`\n✔ ${email} is an operator (in default ADMIN_EMAILS). Sign in at /investor/admin/login with QA_TEST_ADMIN_PASSWORD.`);
console.log("  (Not an investor — no investors row; must stay OUT of the investor portal user flow.)");
