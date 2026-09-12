/**
 * LingoPure — Org onboarding wizard state machine (C3 §6).
 *
 * Tracks where an organisation is in the onboarding lifecycle:
 *   package → departments → staff → teachers → baseline → curriculum → done
 *
 * Steps 4–5 (baseline + curriculum) are automatic and triggered by the
 * engine once teacher-student assignments exist. The wizard state machine
 * is linear this phase (no back-navigation complexity).
 */

export const ONBOARDING_STEPS = [
  "package",
  "departments",
  "staff",
  "teachers",
  "baseline",
  "curriculum",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const SERVICE_PACKAGES = [
  "1:1 Tutoring",
  "Tutor + AI",
  "Full BPO",
] as const;

export type ServicePackage = (typeof SERVICE_PACKAGES)[number];

/**
 * Fixed nominated department sets per package (§10.5).
 * The P0/P1 picks from this set; no add/rename UI this phase.
 */
export const PACKAGE_DEPARTMENTS: Record<ServicePackage, string[]> = {
  "1:1 Tutoring": ["Academic"],
  "Tutor + AI": ["Academic", "AI Coaching"],
  "Full BPO": ["Inbound", "Outbound", "Logistics"],
};

export type OrgOnboardingState = {
  organisation_id: string;
  step: OnboardingStep;
  package: ServicePackage | null;
  package_selected_at: string | null;
  departments_configured_at: string | null;
  staff_allocated_at: string | null;
  teachers_assigned_at: string | null;
  baseline_at: string | null;
  curriculum_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Returns the next step in the wizard, or null if already done. */
export function nextStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1];
}

/** Returns the 0-indexed progress through the wizard (0 = not started, 6 = done). */
export function progressIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

/** Whether the wizard is complete. */
export function isComplete(state: OrgOnboardingState): boolean {
  return state.step === "done";
}