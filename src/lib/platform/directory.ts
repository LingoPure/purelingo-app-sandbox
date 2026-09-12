/**
 * LingoPure — Platform console data (C4).
 *
 * Everything reads through the USER-scoped client so RLS is genuinely
 * exercised: the 0044 policies grant a platform admin read-all on the org
 * model, and this loader simply queries it. If the caller stopped being an
 * admin (row removed), the queries return nothing — not an error.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminOrgRow = {
  organisation_id: string;
  name: string;
  slug: string;
  created_at: string;
  members_active: number;
};

export type AdminBillingRow = {
  organisation_id: string;
  name: string;
  package: string | null;
  tier: string | null;
  status: string | null;
  price_monthly: number | null;
  currency: string | null;
  next_billing_at: string | null;
  onboarding_done: boolean;
};

export type AdminOnboardingRow = {
  organisation_id: string;
  name: string;
  slug: string;
  step: string | null;
  package: string | null;
  package_selected_at: string | null;
  departments_configured_at: string | null;
  staff_allocated_at: string | null;
  teachers_assigned_at: string | null;
  baseline_at: string | null;
  curriculum_at: string | null;
  completed_at: string | null;
};

export type AdminContentRow = {
  question_bank_version: string;
  assessments_run: number;
  languages: string[];
};

/** The organisation directory for /admin. */
export async function loadOrgDirectory(
  supabase: SupabaseClient
): Promise<AdminOrgRow[]> {
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("organisation_id, status");

  const counts = new Map<string, number>();
  for (const m of memberships ?? []) {
    if (m.status !== "active") continue;
    counts.set(m.organisation_id, (counts.get(m.organisation_id) ?? 0) + 1);
  }

  return (orgs ?? []).map((o) => ({
    organisation_id: o.id,
    name: o.name,
    slug: o.slug,
    created_at: o.created_at,
    members_active: counts.get(o.id) ?? 0,
  }));
}

/** Per-org subscriptions for /admin/billing. */
export async function loadBillingDirectory(
  supabase: SupabaseClient
): Promise<AdminBillingRow[]> {
  const { data: subs } = await supabase.from("subscriptions").select(
    "organisation_id, package, tier, status, price_monthly, currency, next_billing_at"
  );
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name");
  const { data: onboarding } = await supabase
    .from("org_onboarding")
    .select("organisation_id, step");

  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const doneSet = new Set(
    (onboarding ?? []).filter((o) => o.step === "done").map((o) => o.organisation_id)
  );

  const subMap = new Map((subs ?? []).map((s) => [s.organisation_id, s]));
  const allIds = new Set([
    ...subMap.keys(),
    ...(orgs ?? []).map((o) => o.id),
  ]);

  return Array.from(allIds).map((id) => {
    const s = subMap.get(id);
    return {
      organisation_id: id,
      name: orgName.get(id) ?? "Unknown org",
      package: s?.package ?? null,
      tier: s?.tier ?? null,
      status: s?.status ?? null,
      price_monthly: s?.price_monthly ?? null,
      currency: s?.currency ?? null,
      next_billing_at: s?.next_billing_at ?? null,
      onboarding_done: doneSet.has(id),
    };
  });
}

/** Onboarding state per org for /admin/onboarding. */
export async function loadOnboardingDirectory(
  supabase: SupabaseClient
): Promise<AdminOnboardingRow[]> {
  const { data: onboarding } = await supabase
    .from("org_onboarding")
    .select(
      "organisation_id, step, package, package_selected_at, departments_configured_at, staff_allocated_at, teachers_assigned_at, baseline_at, curriculum_at, completed_at"
    );
  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name, slug");

  const orgInfo = new Map((orgs ?? []).map((o) => [o.id, o]));
  return (onboarding ?? []).map((o) => ({
    ...o,
    name: orgInfo.get(o.organisation_id)?.name ?? "Unknown org",
    slug: orgInfo.get(o.organisation_id)?.slug ?? "",
  }));
}

/** Content inventory for /admin/content — question bank versions in use. */
export async function loadContentDirectory(
  supabase: SupabaseClient
): Promise<AdminContentRow[]> {
  const { data: sessions } = await supabase
    .from("assessment_sessions")
    .select("question_bank_version, language, status");

  const byVersion = new Map<string, { count: number; languages: Set<string> }>();
  for (const s of sessions ?? []) {
    const entry = byVersion.get(s.question_bank_version) ?? {
      count: 0,
      languages: new Set<string>(),
    };
    entry.count += 1;
    if (s.language) entry.languages.add(s.language);
    byVersion.set(s.question_bank_version, entry);
  }

  return Array.from(byVersion.entries()).map(([version, e]) => ({
    question_bank_version: version,
    assessments_run: e.count,
    languages: Array.from(e.languages).sort(),
  }));
}