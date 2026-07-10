import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";
import { LogosClient, type LogoRow } from "./logos-client";

/** Client-logo CRUD — upload logos, record written consent, order, and a
 *  draft→publish toggle. A logo displays only when BOTH consent and published
 *  are on (consent is the legal gate). */
export default async function AdminLogosPage() {
  const editor = await getContentEditor();
  const editable = editor ? canEdit(editor.role) : false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_logos")
    .select("id, name, logo_url, consent, published, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">Logos</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Client logos</h1>
      <p className="mt-3 max-w-prose text-mute">
        Upload client logos for the trust strip. A logo appears on the site only when
        <strong> consent</strong> (written permission to display it) and
        <strong> published</strong> are both on. Without a logo image, the client name
        shows as text.
      </p>
      <LogosClient initial={(data as LogoRow[] | null) ?? []} canEdit={editable} />
    </div>
  );
}
