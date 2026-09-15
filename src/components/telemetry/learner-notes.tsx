"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Note = { id: string; body: string; created_at: string };

type Props = {
  learnerId: string;
};

export function LearnerNotes({ learnerId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("learner_notes")
      .select("id, body, created_at")
      .eq("learner_id", learnerId)
      .order("created_at", { ascending: false })
      .limit(6);
    return (data ?? []) as Note[];
  }, [learnerId]);

  useEffect(() => {
    let active = true;
    load().then((rows) => {
      if (active) setNotes(rows);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function save() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from("learner_notes")
        .insert({ learner_id: learnerId, body: text });
      if (insertError) throw insertError;
      setBody("");
      setNotes(await load());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("learner_notes").delete().eq("id", id);
    setNotes(await load());
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="A short reflection or note on today's session…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-t-line bg-[#0b1a27] px-3 py-2 text-sm text-t-text placeholder:text-t-mute focus:border-t-cyan focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="rounded-lg bg-t-orange px-4 py-2 text-sm font-bold text-t-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>

      {error && (
        <p className="text-[12px] text-t-red" role="alert">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {notes.length === 0 && (
          <li className="text-[12px] text-t-mute">
            No notes yet — reflections stay visible here across sessions.
          </li>
        )}
        {notes.map((n) => (
          <li
            key={n.id}
            className="group flex items-start justify-between gap-3 rounded-lg border border-t-line bg-[#0b1a27] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-t-soft-mute">{n.body}</p>
              <p className="mt-1 text-[12px] text-t-mute">
                {new Date(n.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(n.id)}
              aria-label="Delete note"
              className="text-t-mute opacity-0 transition hover:text-t-red group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}