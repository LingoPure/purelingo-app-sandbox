import { getContentEditor, canEdit } from "@/lib/content/auth";
import { createClient } from "@/lib/supabase/server";
import { TestimonialsClient, type TestimonialRow } from "./testimonials-client";

/** Testimonials CRUD — add real named testimonials with photo, order and a
 *  draft→publish toggle. Public shows published only; preview shows drafts. */
export default async function AdminTestimonialsPage() {
  const editor = await getContentEditor();
  const editable = editor ? canEdit(editor.role) : false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_testimonials")
    .select("id, quote, name, role, company, photo_url, published, sort_order")
    .order("sort_order", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">Testimonials</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Testimonials</h1>
      <p className="mt-3 max-w-prose text-mute">
        Add named testimonials — a photo, first name, role, company and one specific
        claim. A testimonial shows on the site only when <strong>published</strong>;
        drafts are visible in preview first. Capture written consent before publishing.
      </p>
      <TestimonialsClient
        initial={(data as TestimonialRow[] | null) ?? []}
        canEdit={editable}
      />
    </div>
  );
}
