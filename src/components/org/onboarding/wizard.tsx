"use client";

import { useCallback, useState } from "react";
import { SERVICE_PACKAGES, type ServicePackage } from "@/lib/org/onboarding";
import type { OnboardingBundle } from "@/lib/org/service";

type Step =
  | "package"
  | "departments"
  | "staff"
  | "teachers"
  | "baseline"
  | "curriculum"
  | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "package", label: "1 · Package" },
  { id: "departments", label: "2 · Departments" },
  { id: "staff", label: "3 · Staff" },
  { id: "teachers", label: "4 · Teachers" },
  { id: "baseline", label: "5 · Baseline" },
  { id: "curriculum", label: "6 · Curriculum" },
  { id: "done", label: "7 · Complete" },
];

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? "Request failed");
  return json as T;
}

export function OrgOnboardingWizard({
  orgId,
  initialBundle,
}: {
  orgId: string;
  initialBundle: OnboardingBundle;
}) {
  const [bundle, setBundle] = useState<OnboardingBundle>(initialBundle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/org/${orgId}/onboarding`);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Could not load onboarding");
    setBundle(json);
  }, [orgId]);

  async function act<T>(body: unknown): Promise<T> {
    setBusy(true);
    setError(null);
    try {
      const result = await post<T>(`/api/org/${orgId}/onboarding`, body);
      await refresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const state = bundle.state as Record<string, unknown> | null;
  const step = (state?.step as Step) ?? "package";

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progress rail */}
      <ol className="mb-8 flex flex-wrap gap-2" aria-label="Onboarding progress">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = STEPS.indexOf(s) < STEPS.findIndex((x) => x.id === step);
          return (
            <li
              key={s.id}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-navy text-white"
                  : done
                    ? "bg-teal/15 text-teal"
                    : "bg-mist text-mute"
              }`}
            >
              {i + 1}. {s.label}
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mb-4 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <StepPanel
        step={step}
        bundle={bundle}
        busy={busy}
        act={act}
      />
    </div>
  );
}

function StepPanel({
  step,
  bundle,
  busy,
  act,
}: {
  step: Step;
  bundle: OnboardingBundle;
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  switch (step) {
    case "package":
      return <PackageStep bundle={bundle} busy={busy} act={act} />;
    case "departments":
      return <DepartmentsStep bundle={bundle} busy={busy} act={act} />;
    case "staff":
      return <StaffStep bundle={bundle} busy={busy} act={act} />;
    case "teachers":
      return <TeachersStep bundle={bundle} busy={busy} act={act} />;
    case "baseline":
    case "curriculum":
      return <AutoStep step={step} busy={busy} act={act} />;
    case "done":
      return <DoneStep />;
    default:
      return <p className="text-sm text-mute">Unknown step.</p>;
  }
}

function StepCard({
  eyebrow,
  title,
  children,
  busy,
  onSave,
  saveLabel,
  onDefer,
  deferLabel,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  busy: boolean;
  onSave: () => Promise<void>;
  saveLabel: string;
  onDefer?: () => Promise<void>;
  deferLabel?: string;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="rounded-xl border border-line bg-white p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave();
        } catch {
          // act() has already surfaced the message in the wizard error banner.
        } finally {
          setSaving(false);
        }
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-teal">
        {eyebrow}
      </p>
      <h2 className="mb-4 mt-1 font-serif text-2xl text-navy">{title}</h2>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || busy}
          className="rounded-md bg-navy px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {saving ? "Saving…" : saveLabel}
        </button>
        {deferLabel && onDefer && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const fn = onDefer;
              void fn();
            }}
            className="text-sm text-mute underline-offset-4 hover:text-teal hover:underline disabled:opacity-60"
          >
            {deferLabel}
          </button>
        )}
      </div>
    </form>
  );
}

function PackageStep({
  bundle,
  busy,
  act,
}: {
  bundle: OnboardingBundle;
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  const [pkg, setPkg] = useState<ServicePackage>(
    (bundle.state?.package as ServicePackage) ?? "1:1 Tutoring"
  );
  const current = bundle.state?.package ?? null;

  return (
    <StepCard
      eyebrow="Step 1 · Package"
      title="Which service package does this organisation subscribe to?"
      busy={busy}
      onSave={() => act({ action: "select-package", package: pkg })}
      saveLabel="Next: departments →"
    >
      <p className="mb-4 text-sm leading-relaxed text-mute">
        The package is a data-source toggle, not a feature gate — every learner follows the
        same flow, but higher packages unlock work data (voice, emails) for the 2K engine.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICE_PACKAGES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPkg(p)}
            aria-pressed={pkg === p}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              pkg === p
                ? "border-teal bg-teal/10 text-ink"
                : "border-line bg-white text-ink hover:border-teal/50"
            }`}
          >
            <span className="block text-sm font-semibold">{p}</span>
            <span className="mt-1 block text-xs text-mute">
              {p === "1:1 Tutoring"
                ? "Live tutor sessions + 2K baseline"
                : p === "Tutor + AI"
                  ? "+ AI coaching & voice practice"
                  : "Full BPO work-data analysis"}
            </span>
          </button>
        ))}
      </div>
      {current && current !== pkg && (
        <p className="mt-3 text-xs text-mute">
          Currently set to: <span className="font-medium text-ink">{String(current)}</span> — saving
          will update the department set &amp; billing.
        </p>
      )}
    </StepCard>
  );
}

function DepartmentsStep({
  bundle,
  busy,
  act,
}: {
  bundle: OnboardingBundle;
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  const [keep, setKeep] = useState<Set<string>>(
    () =>
      new Set(
        bundle.departments.filter((d) => !d.is_archived).map((d) => d.name)
      )
  );

  if (!bundle.departments.length) {
    return (
      <p className="text-sm text-mute">
        No departments configured yet — run the package step first.
      </p>
    );
  }

  return (
    <StepCard
      eyebrow="Step 2 · Departments"
      title="Confirm this organisation's departments"
      busy={busy}
      onSave={() =>
        act({ action: "set-departments", keep: Array.from(keep) })
      }
      saveLabel="Next: staff →"
    >
      <p className="mb-4 text-sm leading-relaxed text-mute">
        Toggle departments off to archive them. Unselected departments are hidden from the
        org portal.
      </p>
      <div className="flex flex-col gap-2">
        {bundle.departments.map((d) => (
          <label
            key={d.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3"
          >
            <input
              type="checkbox"
              checked={keep.has(d.name)}
              onChange={() =>
                setKeep((prev) => {
                  const next = new Set(prev);
                  if (next.has(d.name)) next.delete(d.name);
                  else next.add(d.name);
                  return next;
                })
              }
              className="h-4 w-4 accent-teal"
            />
            <span className="text-sm font-medium text-ink">{d.name}</span>
          </label>
        ))}
      </div>
    </StepCard>
  );
}

function StaffStep({
  bundle,
  busy,
  act,
}: {
  bundle: OnboardingBundle;
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  const [rows, setRows] = useState<
    Array<{ email: string; role: "staff" | "teacher"; deptId: string }>
  >([{ email: "", role: "staff", deptId: bundle.departments[0]?.id ?? "" }]);

  const depts = bundle.departments.filter((d) => !d.is_archived);

  return (
    <StepCard
      eyebrow="Step 3 · Staff"
      title="Allocate staff and teachers to departments"
      busy={busy}
      onSave={() =>
        act({
          action: "allocate-staff",
          allocations: rows
            .filter((r) => r.email.trim())
            .map((r) => ({
              email: r.email.trim(),
              role: r.role,
              departmentId: r.deptId || undefined,
            })),
        })
      }
      saveLabel="Next: teachers →"
    >
      <p className="mb-4 text-sm leading-relaxed text-mute">
        Enter the work email of each person. People who already have a login are added as
        active members; invite-by-email arrives in C5.
      </p>

      <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_150px_1fr_auto] sm:items-center">
        <p className="text-xs font-semibold text-mute">Email</p>
        <p className="text-xs font-semibold text-mute">Role</p>
        <p className="text-xs font-semibold text-mute">Department</p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid gap-2 sm:grid-cols-[1fr_150px_1fr_auto] sm:items-center"
          >
            <input
              type="email"
              required
              value={row.email}
              placeholder="name@client.com"
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, j) => (j === i ? { ...r, email: e.target.value } : r))
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            />
            <select
              value={row.role}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, j) =>
                    j === i
                      ? {
                          ...r,
                          role: e.target.value === "teacher" ? "teacher" : "staff",
                        }
                      : r
                  )
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            >
              <option value="staff">Staff</option>
              <option value="teacher">Teacher</option>
            </select>
            <select
              value={row.deptId}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, j) => (j === i ? { ...r, deptId: e.target.value } : r))
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            >
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              disabled={rows.length === 1}
              className="rounded-md px-3 py-2 text-sm text-mute transition hover:bg-coral/10 hover:text-coral disabled:opacity-40"
              aria-label={`Remove row ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            { email: "", role: "staff", deptId: depts[0]?.id ?? "" },
          ])
        }
        className="mt-2 text-sm text-teal underline-offset-4 hover:underline"
      >
        + Add another person
      </button>

      {bundle.staff.length > 0 && (
        <div className="mt-4 rounded-lg bg-mist p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-mute">
            Currently allocated ({bundle.staff.length})
          </p>
          <ul className="mt-1 flex flex-wrap gap-2 text-xs">
            {bundle.staff.map((s) => (
              <li key={s.membership_id} className="rounded-full bg-white px-3 py-1">
                <span className="font-medium text-ink">{s.email ?? s.user_id}</span>
                <span className="text-mute"> · {s.role}</span>
                <span className="text-mute"> · {s.department_name ?? "unassigned"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StepCard>
  );
}

function TeachersStep({
  bundle,
  busy,
  act,
}: {
  bundle: OnboardingBundle;
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  const existing = new Map(
    (bundle.assignments ?? []).map((a) => [`${a.teacher_id}:${a.student_id}`, a])
  );
  const [links, setLinks] = useState<
    Array<{ teacherId: string; studentId: string; role: "primary" | "specialist" }>
  >(() => {
    // Pre-fill existing active assignments.
    const seen = new Set<string>();
    const initial: Array<{
      teacherId: string;
      studentId: string;
      role: "primary" | "specialist";
    }> = [];
    for (const a of bundle.assignments ?? []) {
      if (!a.ended_at && !seen.has(`${a.teacher_id}:${a.student_id}`)) {
        seen.add(`${a.teacher_id}:${a.student_id}`);
        initial.push({
          teacherId: a.teacher_id,
          studentId: a.student_id,
          role: a.assignment_role as "primary" | "specialist",
        });
      }
    }
    if (!initial.length && bundle.teachers[0] && bundle.learners[0]) {
      initial.push({
        teacherId: bundle.teachers[0].teacher_id,
        studentId: bundle.learners[0].student_id,
        role: "primary",
      });
    }
    return initial;
  });

  if (!bundle.teachers.length || !bundle.learners.length) {
    return (
      <StepCard
        eyebrow="Step 4 · Teachers"
        title="Assign coaches to learners"
        busy={busy}
        onSave={() => act({ action: "assign-teachers", assignments: [] })}
        saveLabel="Skip (no coach data yet)"
      >
        <p className="text-sm leading-relaxed text-mute">
          Assignments need at least one active teacher and one learner under this
          organisation. Seed teachers and learners first, then return here.
        </p>
      </StepCard>
    );
  }

  return (
    <StepCard
      eyebrow="Step 4 · Teachers"
      title="Assign coaches to learners"
      busy={busy}
      onSave={() =>
        act({
          action: "assign-teachers",
          assignments: links.map((l) => ({
            teacherUserId: l.teacherId,
            studentUserId: l.studentId,
            assignmentRole: l.role,
          })),
        })
      }
      saveLabel="Go to baseline →"
      onDefer={() => act({ action: "finish" })}
      deferLabel="Skip assignments"
    >
      <p className="mb-4 text-sm leading-relaxed text-mute">
        Each learner gets one primary coach and optional specialists. The A3 teacher report
        is unlocked by this assignment link.
      </p>
      <div className="flex flex-col gap-2">
        {links.map((link, i) => (
          <div
            key={i}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto] sm:items-center"
          >
            <select
              value={link.teacherId}
              onChange={(e) =>
                setLinks((prev) =>
                  prev.map((l, j) => (j === i ? { ...l, teacherId: e.target.value } : l))
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            >
              {bundle.teachers.map((t) => (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            <select
              value={link.studentId}
              onChange={(e) =>
                setLinks((prev) =>
                  prev.map((l, j) => (j === i ? { ...l, studentId: e.target.value } : l))
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            >
              {bundle.learners.map((l) => (
                <option key={l.student_id} value={l.student_id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              value={link.role}
              onChange={(e) =>
                setLinks((prev) =>
                  prev.map((l, j) =>
                    j === i
                      ? {
                          ...l,
                          role: e.target.value === "specialist" ? "specialist" : "primary",
                        }
                      : l
                  )
                )
              }
              className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-teal"
            >
              <option value="primary">Primary coach</option>
              <option value="specialist">Specialist</option>
            </select>
            <button
              type="button"
              onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
              disabled={links.length === 1}
              className="rounded-md px-3 py-2 text-sm text-mute transition hover:bg-coral/10 hover:text-coral disabled:opacity-40"
              aria-label={`Remove row ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setLinks((prev) => [
            ...prev,
            {
              teacherId: bundle.teachers[0].teacher_id,
              studentId: bundle.learners[0].student_id,
              role: "primary",
            },
          ])
        }
        className="mt-2 text-sm text-teal underline-offset-4 hover:underline"
      >
        + Add another assignment
      </button>

      {existing.size > 0 && (
        <p className="mt-3 text-xs text-mute">
          {existing.size} existing link{existing.size === 1 ? "" : "s"} may already be
          stored — saving is idempotent.
        </p>
      )}
    </StepCard>
  );
}

function AutoStep({
  step,
  busy,
  act,
}: {
  step: "baseline" | "curriculum";
  busy: boolean;
  act: <T>(body: unknown) => Promise<T>;
}) {
  const label =
    step === "baseline"
      ? "2K baseline assessments run automatically per learner"
      : "AI generates each learner's curriculum + timeline from the C0 engine";
  return (
    <StepCard
      eyebrow={`Step ${step === "baseline" ? "5" : "6"} · Automatic`}
      title={step === "baseline" ? "Baseline assessments started" : "Curriculum generation queued"}
      busy={busy}
      onSave={() => act({ action: "finish" })}
      saveLabel="Mark onboarding complete →"
    >
      <p className="text-sm leading-relaxed text-mute">{label}</p>
    </StepCard>
  );
}

function DoneStep() {
  return (
    <div className="rounded-xl border border-teal/30 bg-teal/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal">
        Step 7 · Complete
      </p>
      <h2 className="mb-2 mt-1 font-serif text-2xl text-navy">
        Onboarding complete — portals unlocked
      </h2>
      <p className="text-sm leading-relaxed text-mute">
        Your organisation can now operate the learner flow. Data gates are enforced by the
        database (RLS): org admins see their org, teachers see only their assigned students.
      </p>
    </div>
  );
}