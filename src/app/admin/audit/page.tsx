import { createClient } from "@/lib/supabase/server";

type AuditRow = {
  section: string | null;
  block_key: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};

function trunc(s: string | null, n = 60): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Change history — who changed what, when. Read-only, append-only. */
export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_content_audit")
    .select("section, block_key, field, old_value, new_value, changed_by, changed_at")
    .order("changed_at", { ascending: false })
    .limit(150);
  const rows = (data as AuditRow[] | null) ?? [];

  // Resolve editor emails where visible (admins see all content_editors).
  const { data: eds } = await supabase.from("content_editors").select("user_id, email");
  const emailByUser = new Map(
    ((eds as Array<{ user_id: string | null; email: string }> | null) ?? [])
      .filter((e) => e.user_id)
      .map((e) => [e.user_id as string, e.email])
  );

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">History</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Change history</h1>
      <p className="mt-3 max-w-prose text-mute">
        Every content change — copy edits, status changes, publishes, and testimonial or
        logo edits — recorded automatically. Append-only; the most recent 150 are shown.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-cream bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-cream text-mute">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">Where</th>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-mute">
                  No changes yet.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-cream/60 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-mute">
                    {new Date(r.changed_at).toLocaleString("en-AU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 text-navy">
                    {r.changed_by ? emailByUser.get(r.changed_by) ?? "—" : "—"}
                  </td>
                  <td className="px-3 py-2 text-navy">
                    {r.section}
                    <span className="text-mute"> · {r.block_key}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] uppercase tracking-widest text-mute">
                    {r.field}
                  </td>
                  <td className="px-3 py-2 text-mute">
                    <span className="line-through opacity-70">{trunc(r.old_value)}</span>
                    {" → "}
                    <span className="text-navy">{trunc(r.new_value)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
