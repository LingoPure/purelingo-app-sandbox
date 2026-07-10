import { redirect } from "next/navigation";
import { getContentEditor } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";
import { EditorsClient, type EditorRow } from "./editors-client";

/**
 * Editors management — admin only. Lists content editors and invites new ones
 * (reusing the same magic-link invite transport as employer/investor invites).
 */
export default async function AdminEditorsPage() {
  const editor = await getContentEditor();
  if (!editor || editor.role !== "admin") redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("content_editors")
    .select("id, email, role, accepted_at, invited_at")
    .order("invited_at", { ascending: false });

  const editors = (data ?? []) as EditorRow[];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">Editors</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Content editors</h1>
      <p className="mt-3 max-w-prose text-mute">
        Invite people to edit the marketing content. <strong>Admin</strong> can edit
        content and manage editors; <strong>marketing</strong> can edit content;
        <strong> read-only</strong> can preview. Editors reach only the content — never
        learner data, scores or session records.
      </p>
      <EditorsClient initialEditors={editors} />
    </div>
  );
}
