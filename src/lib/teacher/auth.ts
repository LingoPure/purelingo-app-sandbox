import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type TeacherIdentity = {
  teacherId: string;
  userId: string;
  fullName: string;
  email: string;
};

/**
 * Resolves the authenticated user to their teachers table row.
 * SECURITY DEFINER or simple check (teachers table is readable by authenticated users in 0014).
 */
export async function getTeacherIdentity(
  supabase: SupabaseClient,
  user: User
): Promise<TeacherIdentity | null> {
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    teacherId: data.id,
    userId: user.id,
    fullName: data.full_name,
    email: data.email,
  };
}
