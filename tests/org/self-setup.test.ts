import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runSelfSetup,
  SELF_SETUP_SKILLS,
  type SelfSetupInput,
} from "@/lib/org/self-setup";

// ── Recording mock covering every write `runSelfSetup` touches ────────────────

type InsertRecord = { table: string; payload: unknown };
type UpdateRecord = { table: string; payload: unknown; eqColumn: string; eqValue: unknown };

type MockConfig = {
  /** Make a given table's insert return { error } instead of success. */
  insertError?: { table: string; message: string; code?: string };
  /** Make the student update return { error }. */
  updateError?: { message: string };
  /** Injected IDs for the chain of created resources. */
  ids?: { org?: string; employer?: string; role?: string };
  /**
   * Number of times the `organisations` insert should fail with a
   * unique-violation (23505, simulating a colliding slug) before it
   * succeeds. 0/undefined = never collides.
   */
  orgSlugCollisions?: number;
};

function makeAdmin(config: MockConfig = {}) {
  const inserts: InsertRecord[] = [];
  const updates: UpdateRecord[] = [];
  let orgInsertAttempts = 0;

  const chain = {
    inserts,
    updates,
    from(table: string) {
      return {
        insert(payload: unknown) {
          inserts.push({ table, payload });

          if (table === "organisations" && (config.orgSlugCollisions ?? 0) > orgInsertAttempts) {
            orgInsertAttempts += 1;
            const err = {
              message: 'duplicate key value violates unique constraint "organisations_slug_key"',
              code: "23505",
            };
            return { error: err, select: () => ({ single: async () => ({ data: null, error: err }) }) };
          }

          const err = config.insertError?.table === table
            ? { message: config.insertError!.message, code: config.insertError!.code }
            : null;
          // Return .error at the top level (for baselines/membership batch inserts
          // which the service destructures as { error }) plus .select() for the
          // resource-creation steps (org/employer/role) that need .select().single().
          let id = "gen-id";
          if (table === "organisations") id = config.ids?.org ?? "org-1";
          else if (table === "employers") id = config.ids?.employer ?? "emp-1";
          else if (table === "roles") id = config.ids?.role ?? "role-1";
          return {
            error: err,
            select: () => ({
              single: async () => ({
                data: table === "employers"
                  ? { id, organisation_id: "org-1" }
                  : { id },
                error: err,
              }),
            }),
          };
        },
        update(payload: unknown) {
          return {
            eq(column: string, value: unknown) {
              updates.push({ table, payload, eqColumn: column, eqValue: value });
              if (config.updateError && table === "students") {
                return { error: { message: config.updateError.message } };
              }
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { chain, admin: chain as unknown as SupabaseClient };
}

// ── Input builder ─────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<SelfSetupInput> = {}): SelfSetupInput {
  return {
    userId: "user-001",
    orgName: "Test BPO Corp",
    role: "Customer Service",
    nativeLanguage: "vi",
    baselines: {
      speaking: 60,
      listening: 70,
      writing: 45,
      reading: 50,
      grammar: 55,
      live_interaction: 65,
    },
    ...overrides,
  };
}

// ── Happy path ────────────────────────────────────────────────────────────────

test("happy path: creates org → employer → role → baselines → student link → membership", async () => {
  const { chain, admin } = makeAdmin({ ids: { org: "org-99", employer: "emp-99", role: "role-99" } });
  const input = makeInput({ orgName: "Acme & Sons!", userId: "user-42" });

  const result = await runSelfSetup(admin, input);

  assert.equal(result.ok, true);
  if (!result.ok) return; // TS narrowing
  assert.equal(result.organisationId, "org-99");
  assert.equal(result.employerId, "emp-99");
  assert.equal(result.roleId, "role-99");

  // ── Organisation ──
  const orgInsert = chain.inserts.find((r) => r.table === "organisations");
  assert.ok(orgInsert, "should insert into organisations");
  const orgRow = orgInsert.payload as { name: string; slug: string };
  assert.equal(orgRow.name, "Acme & Sons!");
  assert.equal(orgRow.slug, "acme-sons"); // slug-normalised

  // ── Employer ──
  const empInsert = chain.inserts.find((r) => r.table === "employers");
  assert.ok(empInsert, "should insert into employers");
  const empRow = empInsert.payload as { organisation_id: string; default_native_language: string };
  assert.equal(empRow.organisation_id, "org-99");
  assert.equal(empRow.default_native_language, "vi");

  // ── Role ──
  const roleInsert = chain.inserts.find((r) => r.table === "roles");
  assert.ok(roleInsert, "should insert into roles");
  const roleRow = roleInsert.payload as { name: string; employer_id: string };
  assert.equal(roleRow.name, "Customer Service");
  assert.equal(roleRow.employer_id, "emp-99");

  // ── Baselines (6 rows, correct skill names + scores) ──
  const baselineInserts = chain.inserts.filter((r) => r.table === "role_baselines");
  assert.equal(baselineInserts.length, 1, "should insert baselines in one batch");
  const baselineRows = baselineInserts[0].payload as Array<{ role_id: string; skill: string; min_score: number }>;
  assert.equal(baselineRows.length, SELF_SETUP_SKILLS.length);
  assert.deepEqual(
    baselineRows.map((r) => r.skill).sort(),
    [...SELF_SETUP_SKILLS].sort(),
  );
  // Spot-check a known value.
  const fluRow = baselineRows.find((r) => r.skill === "speaking");
  assert.ok(fluRow, "speaking baseline present");
  assert.equal(fluRow.min_score, 60);
  assert.equal(fluRow.role_id, "role-99");

  // ── Student link ──
  const studentUpdate = chain.updates.find((r) => r.table === "students");
  assert.ok(studentUpdate, "should update students");
  assert.equal(studentUpdate.eqColumn, "id");
  assert.equal(studentUpdate.eqValue, "user-42");
  assert.deepEqual(studentUpdate.payload, {
    employer_id: "emp-99",
    role_id: "role-99",
    native_language: "vi",
  });

  // ── Membership ──
  const memInsert = chain.inserts.find((r) => r.table === "organisation_memberships");
  assert.ok(memInsert, "should insert into organisation_memberships");
  const memRow = memInsert.payload as { user_id: string; organisation_id: string; role: string; status: string };
  assert.equal(memRow.user_id, "user-42");
  assert.equal(memRow.organisation_id, "org-99");
  assert.equal(memRow.role, "student");
  assert.equal(memRow.status, "active");
});

// ── Slug normalisation ─────────────────────────────────────────────────────────

test("slug: lowercases, collapses non-alphanum, strips edge dashes", async () => {
  const { chain, admin } = makeAdmin();
  await runSelfSetup(admin, makeInput({ orgName: "  Hello & World!!  " }));

  const orgInsert = chain.inserts.find((r) => r.table === "organisations");
  assert.ok(orgInsert, "should insert into organisations");
  assert.equal((orgInsert.payload as { slug: string }).slug, "hello-world");
});

test("slug: all-symbol org name falls back to 'org'", async () => {
  const { chain, admin } = makeAdmin();
  await runSelfSetup(admin, makeInput({ orgName: "***" }));

  const orgInsert = chain.inserts.find((r) => r.table === "organisations");
  assert.ok(orgInsert, "should insert into organisations");
  assert.equal((orgInsert.payload as { slug: string }).slug, "org");
});

// ── Organisation insert fails ──────────────────────────────────────────────────

test("org insert error → stops at 'organisation', no further writes", async () => {
  const { chain, admin } = makeAdmin({ insertError: { table: "organisations", message: "duplicate slug" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "organisation");
  assert.equal(result.error, "duplicate slug");

  // Only one write attempted (org insert), nothing else.
  assert.equal(chain.inserts.length, 1);
  assert.equal(chain.updates.length, 0);
});

// ── Org slug collision (ISS-049) ───────────────────────────────────────────────

test("org slug collision (23505) retries with a suffix and succeeds", async () => {
  const { chain, admin } = makeAdmin({ orgSlugCollisions: 2 });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, true);

  const orgInserts = chain.inserts.filter((r) => r.table === "organisations");
  assert.equal(orgInserts.length, 3, "should retry twice then succeed on the third attempt");
  const firstSlug = (orgInserts[0].payload as { slug: string }).slug;
  const thirdSlug = (orgInserts[2].payload as { slug: string }).slug;
  assert.notEqual(thirdSlug, firstSlug, "the succeeding attempt should use a de-duplicated slug");
  assert.ok(thirdSlug.startsWith(firstSlug + "-"), "the suffix should be appended to the base slug");
});

test("org slug collision that never resolves returns a friendly message, not the raw Postgres error", async () => {
  const { admin } = makeAdmin({ orgSlugCollisions: 10 }); // more than the 5-attempt cap

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "organisation");
  assert.doesNotMatch(result.error, /constraint|duplicate key|organisations_slug_key/i);
});

// ── Employer insert fails ─────────────────────────────────────────────────────

test("employer insert error → stops at 'employer'", async () => {
  const { chain, admin } = makeAdmin({ insertError: { table: "employers", message: "FK violation" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "employer");
  assert.equal(result.error, "FK violation");

  const tables = chain.inserts.map((r) => r.table);
  assert.deepEqual(tables, ["organisations", "employers"]);
  assert.equal(chain.updates.length, 0);
});

// ── Role insert fails ─────────────────────────────────────────────────────────

test("role insert error → stops at 'role'", async () => {
  const { chain, admin } = makeAdmin({ insertError: { table: "roles", message: "constraint" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "role");
  assert.deepEqual(chain.inserts.map((r) => r.table), ["organisations", "employers", "roles"]);
});

// ── Baselines insert fails ────────────────────────────────────────────────────

test("baseline insert error → stops at 'baselines'", async () => {
  const { chain, admin } = makeAdmin({ insertError: { table: "role_baselines", message: "check violation" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "baselines");
  assert.equal(chain.inserts.length, 4); // org, emp, role, baselines
  assert.equal(chain.updates.length, 0);
});

// ── Student update fails ──────────────────────────────────────────────────────

test("student update error → stops at 'student'", async () => {
  const { chain, admin } = makeAdmin({ updateError: { message: "student not found" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "student");
  assert.equal(result.error, "student not found");
  assert.equal(chain.inserts.length, 4); // org, emp, role, baselines
  assert.equal(chain.updates.length, 1); // student only
});

// ── Membership insert fails ───────────────────────────────────────────────────

test("membership insert error → stops at 'membership'", async () => {
  const { chain, admin } = makeAdmin({ insertError: { table: "organisation_memberships", message: "RLS denied" } });

  const result = await runSelfSetup(admin, makeInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.step, "membership");
  assert.equal(result.error, "RLS denied");
  assert.equal(chain.inserts.length, 5); // org, emp, role, baselines, membership
  assert.equal(chain.updates.length, 1); // student
});

// ── All baseline skills are seeded with correct scores ─────────────────────────

test("all 6 SELF_SETUP_SKILLS are seeded with the values from input.baselines", async () => {
  const { chain, admin } = makeAdmin();
  const baselines = {
    speaking: 99,
    listening: 55,
    writing: 77,
    reading: 44,
    grammar: 66,
    live_interaction: 88,
  };
  await runSelfSetup(admin, makeInput({ baselines }));

  const baselineRows = chain.inserts
    .filter((r) => r.table === "role_baselines")
    .flatMap((r) => r.payload as Array<{ skill: string; min_score: number }>);

  for (const skill of SELF_SETUP_SKILLS) {
    const row = baselineRows.find((r) => r.skill === skill);
    assert.ok(row, `missing baseline: ${skill}`);
    assert.equal(row.min_score, baselines[skill]);
  }
});
