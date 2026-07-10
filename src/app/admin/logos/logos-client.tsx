"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAsset } from "@/lib/content/upload";

export type LogoRow = {
  id: string;
  name: string;
  logo_url: string | null;
  consent: boolean;
  published: boolean;
  sort_order: number;
};

type Item = Omit<LogoRow, "id"> & { id: string | null };

const blank = (): Item => ({
  id: null,
  name: "",
  logo_url: null,
  consent: false,
  published: false,
  sort_order: 0,
});

export function LogosClient({
  initial,
  canEdit,
}: {
  initial: LogoRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(idx: number, p: Partial<Item>) {
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...p } : x)));
  }

  async function save(idx: number) {
    const it = items[idx];
    if (!it.name.trim()) {
      setError("Client name is required.");
      return;
    }
    setError(null);
    setBusy(`save-${idx}`);
    try {
      const payload = {
        name: it.name,
        logo_url: it.logo_url,
        consent: it.consent,
        published: it.published,
        sort_order: Number(it.sort_order) || 0,
      };
      const res = await fetch("/api/admin/logos", {
        method: it.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(it.id ? { id: it.id, ...payload } : payload),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Save failed");
        return;
      }
      if (!it.id && body.id) patch(idx, { id: body.id });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(idx: number) {
    const it = items[idx];
    if (it.id) {
      setBusy(`del-${idx}`);
      await fetch(`/api/admin/logos?id=${it.id}`, { method: "DELETE" });
      setBusy(null);
    }
    setItems((xs) => xs.filter((_, i) => i !== idx));
    router.refresh();
  }

  async function onLogo(idx: number, file: File) {
    setBusy(`logo-${idx}`);
    setError(null);
    try {
      const url = await uploadAsset(file, "logo");
      patch(idx, { logo_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      {items.map((it, idx) => (
        <div key={it.id ?? `new-${idx}`} className="rounded-lg border border-cream bg-paper p-4">
          <div className="flex flex-wrap items-center gap-4">
            {it.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.logo_url} alt={it.name} className="h-8 max-w-[140px] object-contain" />
            ) : null}
            <input
              value={it.name}
              disabled={!canEdit}
              onChange={(e) => patch(idx, { name: e.target.value })}
              placeholder="Client name"
              className="min-h-[44px] flex-1 rounded-md border border-cream px-3 text-base text-navy disabled:bg-mist"
            />
            <span className="cursor-pointer rounded-md border border-cream px-3 py-2 text-sm text-navy hover:bg-mist">
              {it.logo_url ? "Change logo" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                disabled={!canEdit || busy === `logo-${idx}`}
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onLogo(idx, e.target.files[0])}
              />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" checked={it.consent} disabled={!canEdit} onChange={(e) => patch(idx, { consent: e.target.checked })} />
              Consent to display
            </label>
            <label className="flex items-center gap-2 text-sm text-navy">
              <input type="checkbox" checked={it.published} disabled={!canEdit} onChange={(e) => patch(idx, { published: e.target.checked })} />
              Published (live)
            </label>
            <label className="flex items-center gap-2 text-sm text-mute">
              Order
              <input type="number" value={it.sort_order} disabled={!canEdit} onChange={(e) => patch(idx, { sort_order: Number(e.target.value) })} className="w-16 rounded-md border border-cream px-2 py-1 text-navy" />
            </label>
          </div>
          {canEdit ? (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => save(idx)} disabled={busy === `save-${idx}`} className="inline-flex min-h-[40px] items-center rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-paper hover:bg-navy-deep disabled:opacity-50">
                {busy === `save-${idx}` ? "Saving…" : it.id ? "Save" : "Create"}
              </button>
              <button type="button" onClick={() => remove(idx)} disabled={busy === `del-${idx}`} className="inline-flex min-h-[40px] items-center rounded-md border border-coral/40 px-3 py-1.5 text-sm font-medium text-coral hover:bg-coral/5 disabled:opacity-50">
                Delete
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {canEdit ? (
        <button type="button" onClick={() => setItems((xs) => [...xs, blank()])} className="inline-flex min-h-[44px] items-center rounded-md border border-cream bg-paper px-4 py-2 text-sm font-medium text-navy hover:bg-mist">
          + Add logo
        </button>
      ) : null}
    </div>
  );
}
