import { test } from "node:test";
import assert from "node:assert/strict";
import { createClientOrganisation } from "@/lib/org/service";

const ACTOR = "actor-admin-001";
const ORIGIN = "https://app.lingopure.com";

type TableName =
  | "organisations"
  | "organisation_memberships"
  | "subscriptions"
  | "org_onboarding"
  | "organisation_departments";

/**
 * Recording mock covering exactly what createClientOrganisation +
 * createOrganisation + selectPackage touch. Auth admin calls are
 * configured per test.
 */
function makeAdmin(opts: {
  existingUsers?: Array<{ id: string; email: string }>;
  newUserId?: string;
  linkToken?: string | null;
}) {
  const log: string[] = [];
  const calls = { inserts: {} as Record<string, unknown[]>, updates: [] as unknown[] };

  const admin = {
    log,
    calls,
    auth: {
      admin: {
        async listUsers() {
          log.push("auth.listUsers");
          return { data: { users: opts.existingUsers ?? [] }, error: null };
        },
        async inviteUserByEmail() {
          log.push("auth.inviteUserByEmail");
          return {
            data: { user: { id: opts.newUserId ?? "owner-created-001" } },
            error: null,
          };
        },
        async generateLink() {
          log.push("auth.generateLink");
          if (opts.linkToken === null) return { data: null, error: { message: "no link" } };
          return {
            data: { properties: { hashed_token: opts.linkToken ?? "tok123" } },
            error: null,
          };
        },
      },
    },
    from(table: string) {
      switch (table as TableName) {
        case "organisations":
          return {
            // uniqueSlug probe
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
            insert: (row: unknown) => {
              (calls.inserts.organisations ??= []).push(row);
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "org-001" },
                  }),
                }),
              };
            },
          };
        case "organisation_memberships":
          return {
            insert: async (row: unknown) => {
              (calls.inserts.organisation_memberships ??= []).push(row);
              return { error: null };
            },
          };
        case "subscriptions":
          return {
            insert: async (row: unknown) => {
              (calls.inserts.subscriptions ??= []).push(row);
              return { error: null };
            },
            update: (patch: unknown) => {
              calls.updates.push(["subscriptions", patch]);
              return { eq: async () => ({ error: null }) };
            },
          };
        case "org_onboarding":
          return {
            insert: async (row: unknown) => {
              (calls.inserts.org_onboarding ??= []).push(row);
              return { error: null };
            },
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { step: "package" },
                }),
              }),
            }),
            update: (patch: unknown) => {
              calls.updates.push(["org_onboarding", patch]);
              return { eq: async () => ({ error: null }) };
            },
          };
        case "organisation_departments":
          return {
            upsert: async (row: unknown) => {
              (calls.inserts.organisation_departments ??= []).push(row);
              return { error: null };
            },
          };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return admin as never;
}

test("invite path: provisions the owner account, owns the org, returns a landing link", async () => {
  const admin = makeAdmin({ existingUsers: [], newUserId: "owner-created-001", linkToken: "tok123" });

  const result = await createClientOrganisation(admin, ACTOR, {
    name: "Acme Pacific BPO",
    ownerEmail: "owner@acme-pacific.demo",
    ownerName: "Dana Owner",
    package: "Full BPO",
  }, { origin: ORIGIN });

  assert.equal(result.owner, "invited");
  assert.equal(result.slug, "acme-pacific-bpo");
  assert.ok(admin.log.includes("auth.inviteUserByEmail"));

  // The org owner must be the provisioned account, not the actor.
  const membership = admin.calls.inserts.organisation_memberships[0] as { user_id: string; role: string };
  assert.equal(membership.user_id, "owner-created-001");
  assert.equal(membership.role, "owner");

  // Package advances onboarding to departments + seeds the department set.
  const onboardingUpdate = admin.calls.updates.find(
    (u) => Array.isArray(u) && u[0] === "org_onboarding"
  ) as unknown[] | undefined;
  const deptSeeds = admin.calls.inserts.organisation_departments ?? [];
  assert.ok(onboardingUpdate);
  assert.equal((onboardingUpdate[1] as { step: string }).step, "departments");
  assert.equal(deptSeeds.length, 3); // Full BPO → Inbound/Outbound/Logistics

  // Link points into the wizard at the org slug.
  assert.ok(result.invite);
  assert.equal(result.invite.kind, "invite");
  assert.match(result.invite.actionLink, /token_hash=tok123/);
  assert.match(
    result.invite.actionLink,
    /next=https%3A%2F%2Fapp\.lingopure\.com%2Forg%2Facme-pacific-bpo/
  );
  assert.equal(result.invite.mailOk, false); // no RESEND_API_KEY in tests → copy-paste fallback
});

test("no owner email → the calling platform admin is the org owner", async () => {
  const admin = makeAdmin({ existingUsers: [] });
  const result = await createClientOrganisation(admin, ACTOR, {
    name: "Quiet Client",
  }, { origin: ORIGIN });

  assert.equal(result.owner, "actor");
  assert.equal(result.invite, undefined);
  const membership = admin.calls.inserts.organisation_memberships[0] as { user_id: string };
  assert.equal(membership.user_id, ACTOR);
});

test("existing email user → linked directly as owner, magic-link invite", async () => {
  const admin = makeAdmin({
    existingUsers: [{ id: "owner-existing-001", email: "owner@acme-pacific.demo" }],
    linkToken: "tok456",
  });

  const result = await createClientOrganisation(admin, ACTOR, {
    name: "Linked Client",
    ownerEmail: "OWNER@acme-pacific.demo",
  }, { origin: ORIGIN });

  assert.equal(result.owner, "linked");
  assert.equal(result.invite?.kind, "magiclink");
  assert.ok(admin.log.includes("auth.listUsers"));
  assert.equal(admin.log.includes("auth.inviteUserByEmail"), false);
  const membership = admin.calls.inserts.organisation_memberships[0] as { user_id: string };
  assert.equal(membership.user_id, "owner-existing-001");
});