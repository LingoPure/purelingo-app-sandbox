"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherStudent } from "@/lib/teacher/portal-data";

export function TeacherNotesComposer({
  students,
}: {
  students: TeacherStudent[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not save note");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-2 rounded-lg border border-line bg-white p-4"
    >
      <select
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        aria-label="Student"
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
      >
        <option value="">Select a student…</option>
        {students.map((s) => (
          <option key={s.studentId} value={s.studentId}>
            {s.name}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Session note, observation, or next-step for this student…"
        maxLength={2000}
        rows={3}
        className="min-h-[72px] w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm"
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving || !studentId || !body.trim()}
        className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-paper transition hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}