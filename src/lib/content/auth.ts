/**
 * Content-editor authorisation (global marketing-content admin).
 *
 * A content editor is a normal Supabase-authenticated user who has a row in
 * public.content_editors. Their role is resolved server-side via the
 * current_content_role() SQL function (by user_id OR email). This is separate
 * from employer_admins (tenant-scoped) and investor operators.
 */
import { createClient } from "@/lib/supabase/server";

export type ContentRole = "admin" | "marketing" | "readonly";

export type ContentEditor = {
  userId: string;
  email: string | null;
  role: ContentRole;
};

/** The current user's content role, or null if they are not a content editor. */
export async function getContentEditor(): Promise<ContentEditor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("current_content_role");
  if (error) return null;
  const role = (data as ContentRole | null) ?? null;
  if (!role) return null;

  return { userId: user.id, email: user.email ?? null, role };
}

/** True when the current user can edit content (marketing or admin). */
export function canEdit(role: ContentRole): boolean {
  return role === "admin" || role === "marketing";
}

/** For API gates: returns the editor only if they are an admin, else null. */
export async function requireContentAdmin(): Promise<ContentEditor | null> {
  const editor = await getContentEditor();
  if (!editor || editor.role !== "admin") return null;
  return editor;
}
