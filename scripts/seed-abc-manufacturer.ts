/**
 * Seed the ABC Manufacturer test organisation.
 *
 *   set -a; source .env.local; set +a; npx tsx scripts/seed-abc-manufacturer.ts
 *
 * What it does:
 *   1. Upserts the "ABC Manufacturer" employer
 *   2. Upserts 6 manufacturer roles + their per-skill baselines (0–1000)
 *   3. Creates the admin auth user (mcmdennis@gmail.com / Logoinabc123)
 *      with their students row pinned to ABC Manufacturer
 *   4. For each of 12 personas:
 *        a. Create / look up the auth user (random pwd, email-confirmed)
 *        b. Update students row with name + employer_id + role_id +
 *           target_level
 *        c. Generate a realistic discovery transcript matching the
 *           persona's stated proficiency (Claude #1)
 *        d. Insert/upsert a discovery_sessions row
 *        e. Run the LIVE scoreDiscoverySession (Claude #2 — real scorer)
 *           which writes 6 rows to gap_scores + profile_json
 *
 * Idempotent: the employer + roles are upserted by name; auth users are
 * looked up by email before being created; gap_scores has a
 * (student_id, skill) unique index so re-running just refreshes the
 * scores. Re-running also re-generates the transcripts (so re-running
 * does cost ~24 Sonnet calls — not free, but fine).
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import {
  ABC_EMPLOYER,
  ABC_ADMIN,
  ABC_ROLES,
  ABC_PERSONAS,
  type AbcRole,
  type AbcRoleKey,
} from "../src/lib/seed/abc-personas";
import {
  ABC_DEPARTMENTS,
  ABC_TEACHERS,
  ABC_ASSIGNMENT_BY_ROLE,
  ABC_AI_TUTOR_PERSONA_SLUG,
} from "../src/lib/seed/abc-teachers";
import { generatePersonaTranscript } from "../src/lib/seed/persona-discovery";
import { scoreDiscoverySession } from "../src/lib/scoring/score-discovery";
import { SKILL_KEYS } from "../src/lib/scoring/rubric";

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE URL + SERVICE_ROLE_KEY required");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}

async function findOrCreateAuthUser(
  supabase: ReturnType<typeof adminClient>,
  email: string,
  password: string,
  fullName: string
): Promise<{ userId: string; created: boolean }> {
  // Linear scan via listUsers — cheap at 1k staff, fine for 13 here.
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.toLowerCase() === email.toLowerCase()) {
        return { userId: u.id, created: false };
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    throw new Error(`createUser failed for ${email}: ${error?.message}`);
  }
  return { userId: created.user.id, created: true };
}

async function main() {
  const supabase = adminClient();

  // ─── 1. Employer ─────────────────────────────────────────────────────
  console.log(`◇ Upserting employer "${ABC_EMPLOYER.name}"…`);
  const { data: existingEmp } = await supabase
    .from("employers")
    .select("id")
    .eq("name", ABC_EMPLOYER.name)
    .maybeSingle();
  let employerId: string;
  if (existingEmp) {
    employerId = (existingEmp as { id: string }).id;
    console.log(`  ↳ found existing (${employerId})`);
  } else {
    const { data: created, error } = await supabase
      .from("employers")
      .insert({
        name: ABC_EMPLOYER.name,
        contact_email: ABC_EMPLOYER.contactEmail,
        default_target_level: ABC_EMPLOYER.defaultTargetLevel,
      })
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(`employers insert failed: ${error?.message}`);
    }
    employerId = (created as { id: string }).id;
    console.log(`  ↳ created (${employerId})`);
  }

  // ─── 2. Roles + baselines ────────────────────────────────────────────
  console.log("◇ Upserting roles + baselines…");
  const roleKeyToId = new Map<AbcRoleKey, string>();
  for (const role of ABC_ROLES) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("employer_id", employerId)
      .eq("name", role.name)
      .maybeSingle();

    let roleId: string;
    if (existing) {
      roleId = (existing as { id: string }).id;
      const { error: updateErr } = await supabase
        .from("roles")
        .update({ description: role.description, is_archived: false })
        .eq("id", roleId);
      if (updateErr) {
        throw new Error(`roles update failed: ${updateErr.message}`);
      }
    } else {
      const { data: created, error } = await supabase
        .from("roles")
        .insert({
          employer_id: employerId,
          name: role.name,
          description: role.description,
        })
        .select("id")
        .single();
      if (error || !created) {
        throw new Error(`roles insert failed: ${error?.message}`);
      }
      roleId = (created as { id: string }).id;
    }
    roleKeyToId.set(role.key, roleId);

    const baselineRows = SKILL_KEYS.map((skill) => ({
      role_id: roleId,
      skill,
      min_score: role.baselines[skill],
    }));
    const { error: blErr } = await supabase
      .from("role_baselines")
      .upsert(baselineRows, { onConflict: "role_id,skill" });
    if (blErr) {
      throw new Error(`role_baselines upsert failed: ${blErr.message}`);
    }
    console.log(`  ↳ ${role.name}`);
  }

  // ─── 3. Admin auth user (Dennis) ─────────────────────────────────────
  console.log("◇ Admin user…");
  const adminUser = await findOrCreateAuthUser(
    supabase,
    ABC_ADMIN.email,
    ABC_ADMIN.password,
    ABC_ADMIN.fullName
  );
  if (!adminUser.created) {
    // Reset password to the requested one so the login works.
    const { error } = await supabase.auth.admin.updateUserById(adminUser.userId, {
      password: ABC_ADMIN.password,
    });
    if (error) {
      console.warn(`  ⚠ password reset failed: ${error.message}`);
    }
  }
  // Pin admin to ABC Manufacturer with no role (they're the buyer, not staff).
  const { error: adminStudentErr } = await supabase
    .from("students")
    .update({
      name: ABC_ADMIN.fullName,
      email: ABC_ADMIN.email,
      employer_id: employerId,
      target_level: ABC_ADMIN.targetLevel,
    })
    .eq("id", adminUser.userId);
  if (adminStudentErr) {
    console.warn(`  ⚠ admin students row update: ${adminStudentErr.message}`);
  }
  // Mark them as the employer admin — this is what /employer/* gates on.
  const { error: adminMembershipErr } = await supabase
    .from("employer_admins")
    .upsert(
      {
        auth_user_id: adminUser.userId,
        employer_id: employerId,
        admin_role: "owner",
      },
      { onConflict: "auth_user_id" }
    );
  if (adminMembershipErr) {
    console.warn(
      `  ⚠ employer_admins upsert: ${adminMembershipErr.message}`
    );
  }
  console.log(
    `  ↳ ${adminUser.created ? "created" : "found"}: ${ABC_ADMIN.email} / ${ABC_ADMIN.password} (admin)`
  );

  // ─── 3b. LingoPure-side teaching staff ───────────────────────────────
  console.log("◇ Departments + teachers (LingoPure side)…");
  const departmentNameToId = new Map<string, string>();
  for (const dept of ABC_DEPARTMENTS) {
    const { data: existing } = await supabase
      .from("departments")
      .select("id")
      .eq("name", dept.name)
      .maybeSingle();
    let id: string;
    if (existing) {
      id = (existing as { id: string }).id;
      const { error } = await supabase
        .from("departments")
        .update({ focus: dept.focus })
        .eq("id", id);
      if (error) throw new Error(`department update: ${error.message}`);
    } else {
      const { data: created, error } = await supabase
        .from("departments")
        .insert({ name: dept.name, focus: dept.focus })
        .select("id")
        .single();
      if (error || !created) {
        throw new Error(`department insert: ${error?.message}`);
      }
      id = (created as { id: string }).id;
    }
    departmentNameToId.set(dept.name, id);
    console.log(`  ↳ ${dept.name}`);
  }

  const teacherSlugToId = new Map<string, string>();
  for (const teacher of ABC_TEACHERS) {
    const teacherEmail = `${teacher.slug}@lingopure.demo`;
    const { data: existing } = await supabase
      .from("teachers")
      .select("id")
      .eq("email", teacherEmail)
      .maybeSingle();
    let id: string;
    const baseFields = {
      full_name: teacher.fullName,
      email: teacherEmail,
      classin_account_id: teacher.classinAccountId,
      employment_type: teacher.employmentType,
      bio: teacher.bio,
    };
    if (existing) {
      id = (existing as { id: string }).id;
      const { error } = await supabase
        .from("teachers")
        .update(baseFields)
        .eq("id", id);
      if (error) throw new Error(`teacher update: ${error.message}`);
    } else {
      const { data: created, error } = await supabase
        .from("teachers")
        .insert(baseFields)
        .select("id")
        .single();
      if (error || !created) {
        throw new Error(`teacher insert: ${error?.message}`);
      }
      id = (created as { id: string }).id;
    }
    teacherSlugToId.set(teacher.slug, id);

    // Department membership.
    const deptRows = teacher.departments.map((deptName) => {
      const deptId = departmentNameToId.get(deptName);
      if (!deptId) throw new Error(`unknown department ${deptName}`);
      return {
        teacher_id: id,
        department_id: deptId,
        is_head_of_department: teacher.headOf === deptName,
      };
    });
    const { error: tdErr } = await supabase
      .from("teacher_departments")
      .upsert(deptRows, { onConflict: "teacher_id,department_id" });
    if (tdErr) throw new Error(`teacher_departments upsert: ${tdErr.message}`);
    console.log(
      `  ↳ ${teacher.fullName} (${teacher.employmentType}${teacher.headOf ? ", head" : ""})`
    );
  }

  // ─── 4. Personas ─────────────────────────────────────────────────────
  console.log(`◇ Seeding ${ABC_PERSONAS.length} personas…`);
  let scoredOk = 0;
  let scoredErr = 0;
  for (const persona of ABC_PERSONAS) {
    const role = ABC_ROLES.find((r) => r.key === persona.roleKey);
    if (!role) {
      console.error(`  ✗ unknown role for ${persona.slug}`);
      scoredErr += 1;
      continue;
    }
    const roleId = roleKeyToId.get(persona.roleKey);
    if (!roleId) {
      console.error(`  ✗ role id missing for ${persona.slug}`);
      scoredErr += 1;
      continue;
    }

    const email = `${persona.slug}@abc-manufacturer.demo`;
    console.log(`  ▸ ${persona.fullName} (${persona.proficiencyBand} → ${persona.targetLevel}, ${role.name})`);

    try {
      const auth = await findOrCreateAuthUser(
        supabase,
        email,
        randomPassword(),
        persona.fullName
      );

      const { error: studentErr } = await supabase
        .from("students")
        .update({
          name: persona.fullName,
          email,
          employer_id: employerId,
          role_id: roleId,
          target_level: persona.targetLevel,
          discovery_status: "complete",
        })
        .eq("id", auth.userId);
      if (studentErr) throw new Error(`students update: ${studentErr.message}`);

      // Teacher assignment(s) — one persona is pinned to the AI tutor as
      // a forward-looking demo, everyone else gets the role-based
      // primary (and optional specialist).
      const isAiTutorDemo = persona.slug === ABC_AI_TUTOR_PERSONA_SLUG;
      const assignment = isAiTutorDemo
        ? { primary: "aria-tutor" as string, specialist: undefined as string | undefined }
        : ABC_ASSIGNMENT_BY_ROLE[persona.roleKey];
      const primaryTeacherId = teacherSlugToId.get(assignment.primary);
      if (!primaryTeacherId) {
        throw new Error(`unknown primary teacher slug: ${assignment.primary}`);
      }
      // Replace any existing rows so re-runs don't accumulate duplicates.
      await supabase
        .from("student_teacher_assignments")
        .delete()
        .eq("student_id", auth.userId);
      const assignmentRows: Array<{
        student_id: string;
        teacher_id: string;
        assignment_role: "primary" | "specialist";
      }> = [
        {
          student_id: auth.userId,
          teacher_id: primaryTeacherId,
          assignment_role: "primary",
        },
      ];
      if (assignment.specialist) {
        const specialistId = teacherSlugToId.get(assignment.specialist);
        if (specialistId) {
          assignmentRows.push({
            student_id: auth.userId,
            teacher_id: specialistId,
            assignment_role: "specialist",
          });
        }
      }
      const { error: asnErr } = await supabase
        .from("student_teacher_assignments")
        .insert(assignmentRows);
      if (asnErr) {
        throw new Error(`student_teacher_assignments insert: ${asnErr.message}`);
      }

      // Generate the transcript (Claude #1).
      console.log("    · generating transcript…");
      const transcript = await generatePersonaTranscript(persona, role);
      console.log(`    · transcript: ${transcript.length} turns`);

      // Insert/upsert the discovery_sessions row. We need a deterministic
      // convai_conversation_id so re-runs upsert the same row, which the
      // scorer then updates with profile_json.
      const conversationId = `seed-abc-${persona.slug}`;
      const { error: discErr } = await supabase
        .from("discovery_sessions")
        .upsert(
          {
            student_id: auth.userId,
            convai_conversation_id: conversationId,
            transcript_json: transcript,
            status: "complete",
            completed_at: new Date().toISOString(),
          },
          { onConflict: "convai_conversation_id" }
        );
      if (discErr) {
        throw new Error(`discovery_sessions upsert: ${discErr.message}`);
      }

      // Real LLM scoring (Claude #2 — the production path).
      console.log("    · scoring transcript via real pipeline…");
      const result = await scoreDiscoverySession(supabase, {
        studentId: auth.userId,
        conversationId,
        transcript,
      });
      const skillSummary = SKILL_KEYS.map(
        (k) => `${k.split("_")[0]}=${result.scores[k].score}`
      ).join(" ");
      console.log(`    · scored: ${skillSummary}`);
      scoredOk += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ ${message}`);
      scoredErr += 1;
    }
  }

  console.log("");
  console.log(`✓ Done. Scored ${scoredOk}/${ABC_PERSONAS.length} personas successfully.`);
  if (scoredErr > 0) {
    console.log(`  ⚠ ${scoredErr} persona(s) errored — see above.`);
  }
  console.log("");
  console.log("Login:");
  console.log(`  /login → ${ABC_ADMIN.email} / ${ABC_ADMIN.password}`);
  console.log("  Same creds open the student dashboard AND the employer dashboard");
  console.log("  (the layout routes admins to /employer, everyone else to /dashboard).");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
