import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireOrgRole, type OrgRole } from "@/lib/org/auth";

// ── Org portal role gates (C5) ────────────────────────────────────────────────
//
// The route half of docs/ROLE_MATRIX.md:
//   /org/[slug]/staff, /students, /teachers  → owner/hr ✅, teacher list-only ✅,
//                                              staff/student 🚫
//   /org/[slug]/settings                      → owner/hr ✅ only
//
// requireOrgRole (src/lib/org/auth.ts) reads the role from the DATABASE
// (current_org_role RPC) and fails closed on RPC error — the same behaviour
// the pages rely on.

function makeClient(role: OrgRole | null, rpcError = false): SupabaseClient {
  const c = {
    rpc: async () =>
      rpcError ? { data: null, error: { message: "db down" } } : { data: role, error: null },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "org-1", slug: "celadon", name: "Celadon" },
            error: null,
          }),
        }),
      }),
    }),
  };
  return c as unknown as SupabaseClient;
}

const USER: User = { id: "u-1", aud: "authenticated", role: "authenticated" } as User;

async function granted(role: OrgRole | null, allowed: OrgRole[], rpcError = false) {
  const res = await requireOrgRole(makeClient(role, rpcError), USER, "org-1", allowed);
  return !("status" in res);
}

test("staff/students/teachers gates admit owner and hr", async () => {
  const allowed: OrgRole[] = ["owner", "hr", "teacher"];
  assert.equal(await granted("owner", allowed), true);
  assert.equal(await granted("hr", allowed), true);
});

test("staff/students/teachers gates admit teacher list-only", async () => {
  const allowed: OrgRole[] = ["owner", "hr", "teacher"];
  assert.equal(await granted("teacher", allowed), true);
});

test("staff/students/teachers gates reject staff and student", async () => {
  const allowed: OrgRole[] = ["owner", "hr", "teacher"];
  assert.equal(await granted("staff", allowed), false);
  assert.equal(await granted("student", allowed), false);
});

test("settings gate admits only owner and hr", async () => {
  const settings: OrgRole[] = ["owner", "hr"];
  assert.equal(await granted("owner", settings), true);
  assert.equal(await granted("hr", settings), true);
  assert.equal(await granted("teacher", settings), false);
  assert.equal(await granted("staff", settings), false);
  assert.equal(await granted("student", settings), false);
});

test("RPC failure fails closed — never a grant", async () => {
  const allowed: OrgRole[] = ["owner", "hr", "teacher"];
  assert.equal(await granted("owner", allowed, true), false);
});

test("no roles filter admits any member role", async () => {
  const res = await requireOrgRole(makeClient("staff"), USER, "org-1");
  assert.ok("identity" in res);
  assert.equal(res.identity.role, "staff");
});

test("loadOrgSettings maps org + admins + subscription", async () => {
  const { loadOrgSettings } = await import("@/lib/org/portal-data");

  const calls: string[] = [];
  const supabase = {
    from: (table: string) => {
      return {
        select: () => {
          calls.push(table);
          return {
            eq: () => ({
              order: async () => ({
                data: [{ id: "m-1", user_id: "u-1", role: "owner", status: "active" }],
                error: null,
              }),
              maybeSingle: async () => ({
                data:
                  table === "organisations"
                    ? { id: "org-1", name: "Celadon", slug: "celadon", created_at: "2025-01-01" }
                    : {
                        package: "1:1 Tutoring",
                        tier: "standard",
                        status: "active",
                        price_monthly: 1500,
                        currency: "AUD",
                        next_billing_at: "2026-02-01",
                      },
                error: null,
              }),
            }),
          };
        },
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: "owner@celadon.com" } }, error: null }),
      },
    },
  } as unknown as SupabaseClient;

  const settings = await loadOrgSettings(supabase, "org-1");
  assert.ok(settings);
  assert.equal(settings.org.name, "Celadon");
  assert.equal(settings.subscription?.package, "1:1 Tutoring");
  assert.equal(settings.admins[0].email, "owner@celadon.com");
  assert.equal(settings.admins[0].role, "owner");
});