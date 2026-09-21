import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEmployerAdmin } from "@/lib/employer/auth";

/**
 * Where a just-authenticated user should land, given an optional explicit
 * `next` (e.g. from an email link's `?next=...`) and the current session.
 *
 * Single source of truth for this decision — was previously duplicated
 * between the password-login server action and the `/auth/callback` route.
 * Both now call this.
 *
 * HR is checked FIRST, and it is a different kind of user rather than a
 * competing role. LingoPure's own staff are not learners and not employer
 * admins — the learner dashboard is a dead end for them and nothing in the
 * product chrome links to /hr.
 *
 * Swallows its own lookup failures on purpose — a lookup problem must land
 * the user somewhere, not on an error page.
 */
export async function resolvePostAuthTarget(
  supabase: SupabaseClient,
  explicitNext?: string | null
): Promise<string> {
  if (explicitNext && explicitNext.startsWith("/")) return explicitNext;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/dashboard";

  try {
    const { data: hrEmployeeId } = await supabase.rpc("hr_current_employee");
    if (hrEmployeeId) return "/hr";
  } catch {
    // fall through to the remaining destinations
  }

  const admin = await loadEmployerAdmin(supabase, user.id);
  return admin ? "/employer" : "/dashboard";
}
