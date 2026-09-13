"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type EditorBlock = {
  section: string;
  key: string;
  label: string;
  group: string;
  multiline: boolean;
  en: string;
  vi: string;
  status: "ready" | "confirm" | "pending";
};

type Local = { en: string; vi: string; status: EditorBlock["status"]; saving?: boolean; saved?: boolean; dirty?: boolean };

export function ContentEditorClient({
  blocks,
  canEdit,
}: {
  blocks: EditorBlock[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, Local>>(() =>
    Object.fromEntries(
      blocks.map((b) => [`${b.section}::${b.key}`, { en: b.en, vi: b.vi, status: b.status }])
    )
  );
  const [publishing, setPublishing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const groups = useMemo(() => {
    const g: Record<string, EditorBlock[]> = {};
    for (const b of blocks) (g[b.group] ??= []).push(b);
    return Object.entries(g);
  }, [blocks]);

  function update(id: string, patch: Partial<Local>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch, dirty: true, saved: false } }));
  }

  async function save(b: EditorBlock) {
    const id = `${b.section}::${b.key}`;
    const cur = state[id];
    update(id, { saving: true });
    try {
      const res = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: b.section,
          block_key: b.key,
          draft_en: cur.en,
          draft_vi: cur.vi || null,
          status: cur.status,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setBanner(body.error ?? `Save failed (HTTP ${res.status})`);
        setState((s) => ({ ...s, [id]: { ...s[id], saving: false } }));
        return;
      }
      setState((s) => ({ ...s, [id]: { ...s[id], saving: false, saved: true, dirty: false } }));
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Save failed");
      setState((s) => ({ ...s, [id]: { ...s[id], saving: false } }));
    }
  }

  async function publish() {
    setPublishing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/content/publish", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { published?: number; error?: string };
      setBanner(res.ok ? `Published ${body.published ?? 0} change(s) — the live site is updated.` : body.error ?? "Publish failed");
      if (res.ok) router.refresh();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="sticky top-0 z-10 -mx-6 mb-4 flex flex-wrap items-center gap-3 border-b border-cream bg-mist px-6 py-3">
        <a
          href="/preview"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-md border border-cream bg-paper px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
        >
          Preview draft →
        </a>
        {canEdit ? (
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="inline-flex min-h-[44px] items-center rounded-md bg-go px-4 py-2 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-ai-green)" }}
          >
            {publishing ? "Publishing…" : "Publish all drafts"}
          </button>
        ) : (
          <span className="text-sm text-mute">Read-only — you can preview but not edit.</span>
        )}
        {banner ? <span className="text-sm text-navy">{banner}</span> : null}
      </div>

      {groups.map(([group, gblocks]) => (
        <section key={group} className="mb-8">
          <h2 className="mb-3 font-serif text-lg text-navy">{group}</h2>
          <div className="space-y-4">
            {gblocks.map((b) => {
              const id = `${b.section}::${b.key}`;
              const cur = state[id];
              return (
                <div key={id} className="rounded-lg border border-cream bg-paper p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-navy">{b.label}</label>
                    <select
                      value={cur.status}
                      disabled={!canEdit}
                      onChange={(e) => update(id, { status: e.target.value as Local["status"] })}
                      className="rounded-md border border-cream px-2 py-1 font-mono text-[12px] uppercase tracking-widest text-navy disabled:opacity-60"
                    >
                      <option value="ready">ready</option>
                      <option value="confirm">confirm</option>
                      <option value="pending">pending</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Field
                      label="English"
                      value={cur.en}
                      multiline={b.multiline}
                      disabled={!canEdit}
                      onChange={(v) => update(id, { en: v })}
                    />
                    <Field
                      label="Vietnamese (optional)"
                      value={cur.vi}
                      multiline={b.multiline}
                      disabled={!canEdit}
                      onChange={(v) => update(id, { vi: v })}
                    />
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => save(b)}
                        disabled={cur.saving || !cur.dirty}
                        className="inline-flex min-h-[36px] items-center rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-paper transition hover:bg-navy-deep disabled:opacity-50"
                      >
                        {cur.saving ? "Saving…" : "Save draft"}
                      </button>
                      {cur.saved ? (
                        <span className="text-xs text-ai-green">Saved</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  multiline,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  multiline: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="mb-1 block font-mono text-[12px] uppercase tracking-widest text-mute">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-cream px-3 py-2 text-base text-navy outline-none focus:border-navy/40 disabled:bg-mist"
        />
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[44px] w-full rounded-md border border-cream px-3 text-base text-navy outline-none focus:border-navy/40 disabled:bg-mist"
        />
      )}
    </div>
  );
}
