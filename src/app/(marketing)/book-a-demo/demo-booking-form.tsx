"use client";

import { useState, useTransition } from "react";
import {
  demoBookingSchema,
  PREFERRED_CONTACT_METHODS,
  INDUSTRIES,
  COMPANY_SIZES,
  HQ_MARKETS,
  ENGLISH_LEVELS,
  LEARNING_GOALS,
  CURRENT_TRAINING,
  START_TIMELINES,
  type DemoBookingStep,
  firstSchemaIssue,
} from "./schema";
import { submitDemoBooking, type SubmitResult } from "./actions";

const STEPS: { key: DemoBookingStep; label: string }[] = [
  { key: "contact", label: "Your details" },
  { key: "organisation", label: "Your organisation" },
  { key: "schedule", label: "Schedule" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              i < current
                ? "bg-[var(--lp-accent)] text-[var(--lp-dark)]"
                : i === current
                  ? "bg-[var(--lp-dark)] text-[var(--lp-bg)]"
                  : "bg-[var(--lp-border)] text-[var(--lp-text-muted)]"
            }`}
          >
            {i + 1}
          </span>
          <span className="hidden text-sm sm:inline">{s.label}</span>
          {i < STEPS.length - 1 && (
            <span className="mx-1 hidden h-px w-6 bg-[var(--lp-border)] sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

export function DemoBookingForm() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    email: "",
    phone: "",
    preferredContact: "Email" as string,
  });

  const [org, setOrg] = useState({
    company: "",
    industry: "Technology" as string,
    companySize: "50–199" as string,
    hqMarket: "Vietnam" as string,
    targetLearners: "",
    learnerRoles: "",
    englishLevels: [] as string[],
    currentTraining: "None" as string,
    currentProvider: "",
    goals: [] as string[],
    whyNow: "",
    startTimeline: "ASAP" as string,
    decisionTimeframe: "",
    repReferralEmail: "",
  });

  const [schedule, setSchedule] = useState({
    preferredDate: "",
    preferredTime: "",
    timezone: "UTC+7 (ICT)",
    notes: "",
  });

  function validateStep(): boolean {
    setError(null);
    let res;
    if (step === 0) {
      res = demoBookingSchema.shape.contact.safeParse(contact);
    } else if (step === 1) {
      res = demoBookingSchema.shape.organisation.safeParse(org);
    } else {
      res = demoBookingSchema.shape.schedule.safeParse(schedule);
    }
    if (!res.success) {
      setError(firstSchemaIssue(res.error));
      return false;
    }
    return true;
  }

  function handleNext() {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, 2));
    }
  }

  function handleBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    if (!validateStep()) return;
    setError(null);
    const fd = new FormData();
    Object.entries(contact).forEach(([k, v]) => fd.set(`contact.${k}`, v));
    Object.entries(org).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => fd.append(`organisation.${k}`, item));
      } else {
        fd.set(`organisation.${k}`, v);
      }
    });
    Object.entries(schedule).forEach(([k, v]) => fd.set(`schedule.${k}`, v));
    fd.set("source", "website");

    startTransition(async () => {
      const res = await submitDemoBooking(fd);
      setResult(res);
    });
  }

  function toggleArray(
    field: "goals" | "englishLevels",
    value: string,
    max: number,
  ) {
    setOrg((prev) => {
      const arr = prev[field];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : arr.length < max
          ? [...arr, value]
          : arr;
      return { ...prev, [field]: next };
    });
  }

  if (result) {
    if (!result.ok) {
      return (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Submission failed</p>
          <p className="mt-2 text-sm">{result.error}</p>
          <button
            onClick={() => setResult(null)}
            className="mt-4 text-sm font-semibold underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="mt-4 font-[var(--display)] text-xl font-semibold" style={{ fontFamily: "var(--display)" }}>
          Request received
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--lp-text-muted)" }}>
          We&apos;ll review your details and confirm your walkthrough within one business day. You&apos;ll also receive a confirmation email at <strong>{contact.email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--lp-border)", background: "var(--lp-bg-soft)" }}>
      <div className="border-b p-5 sm:p-6" style={{ borderColor: "var(--lp-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "var(--mono)", color: "var(--lp-accent)" }}>
          Step {step + 1} of 3
        </p>
        <h3 className="mt-1 text-xl font-semibold" style={{ fontFamily: "var(--display)", color: "var(--lp-dark)" }}>
          {STEPS[step].label}
        </h3>
        <div className="mt-4">
          <StepIndicator current={step} />
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required value={contact.firstName} onChange={(v) => setContact({ ...contact, firstName: v })} />
              <Field label="Last name" required value={contact.lastName} onChange={(v) => setContact({ ...contact, lastName: v })} />
            </div>
            <Field label="Job title" required placeholder="e.g. HR Director, CEO" value={contact.jobTitle} onChange={(v) => setContact({ ...contact, jobTitle: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email" required type="email" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} />
              <Field label="Phone" placeholder="+84..." value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} />
            </div>
            <SelectField label="Preferred contact method" value={contact.preferredContact} options={PREFERRED_CONTACT_METHODS} onChange={(v) => setContact({ ...contact, preferredContact: v })} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Company name" required value={org.company} onChange={(v) => setOrg({ ...org, company: v })} />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Industry" value={org.industry} options={INDUSTRIES} onChange={(v) => setOrg({ ...org, industry: v })} />
              <SelectField label="Company size" value={org.companySize} options={COMPANY_SIZES} onChange={(v) => setOrg({ ...org, companySize: v })} />
              <SelectField label="HQ market" value={org.hqMarket} options={HQ_MARKETS} onChange={(v) => setOrg({ ...org, hqMarket: v })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target learners" required type="number" placeholder="e.g. 25" value={org.targetLearners} onChange={(v) => setOrg({ ...org, targetLearners: v })} />
              <Field label="Roles / departments" required placeholder="e.g. Sales, Engineering, HR" value={org.learnerRoles} onChange={(v) => setOrg({ ...org, learnerRoles: v })} />
            </div>
            <fieldset>
              <Legend required>CEFR baseline (what do you estimate?)</Legend>
              <div className="flex flex-wrap gap-2">
                {ENGLISH_LEVELS.map((lv) => (
                  <label key={lv} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${org.englishLevels.includes(lv) ? "border-[var(--lp-accent)] bg-[var(--lp-accent)] text-white" : ""}`} style={!org.englishLevels.includes(lv) ? { borderColor: "var(--lp-border)", color: "var(--lp-text)" } : {}}>
                    <input type="checkbox" className="sr-only" checked={org.englishLevels.includes(lv)} onChange={() => toggleArray("englishLevels", lv, 5)} />
                    {lv}
                  </label>
                ))}
              </div>
            </fieldset>
            <SelectField label="Current English training" value={org.currentTraining} options={CURRENT_TRAINING} onChange={(v) => setOrg({ ...org, currentTraining: v })} />
            <fieldset>
              <Legend required>Learning goals (1–3)</Legend>
              <div className="flex flex-wrap gap-2">
                {LEARNING_GOALS.map((g) => (
                  <label key={g} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${org.goals.includes(g) ? "border-[var(--lp-accent)] bg-[var(--lp-accent)] text-white" : ""}`} style={!org.goals.includes(g) ? { borderColor: "var(--lp-border)", color: "var(--lp-text)" } : {}}>
                    <input type="checkbox" className="sr-only" checked={org.goals.includes(g)} onChange={() => toggleArray("goals", g, 3)} />
                    {g}
                  </label>
                ))}
              </div>
            </fieldset>
            <Textarea label="Why now? What triggered this enquiry?" required value={org.whyNow} onChange={(v) => setOrg({ ...org, whyNow: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="When do you want to start?" value={org.startTimeline} options={START_TIMELINES} onChange={(v) => setOrg({ ...org, startTimeline: v })} />
              <Field label="Decision timeframe" placeholder="e.g. Within 2 weeks" value={org.decisionTimeframe} onChange={(v) => setOrg({ ...org, decisionTimeframe: v })} />
            </div>
            <Field label="Rep referral email (optional)" type="email" placeholder="Did a colleague take the self-assessment? Their email links the two." value={org.repReferralEmail} onChange={(v) => setOrg({ ...org, repReferralEmail: v })} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--lp-text-muted)" }}>
              Pick a date and time for your team walkthrough. We&apos;ll confirm within one business day.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred date" required type="date" value={schedule.preferredDate} onChange={(v) => setSchedule({ ...schedule, preferredDate: v })} />
              <Field label="Preferred time" required type="time" value={schedule.preferredTime} onChange={(v) => setSchedule({ ...schedule, preferredTime: v })} />
            </div>
            <Field label="Timezone" value={schedule.timezone} onChange={(v) => setSchedule({ ...schedule, timezone: v })} />
            <Textarea label="Anything else we should know?" value={schedule.notes} onChange={(v) => setSchedule({ ...schedule, notes: v })} />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={handleBack} className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition" style={{ borderColor: "var(--lp-border)", color: "var(--lp-text)" }}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button onClick={handleNext} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition" style={{ background: "var(--lp-accent)" }}>
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={pending} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60" style={{ background: "var(--lp-accent)" }}>
              {pending ? "Submitting…" : "Submit request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: "var(--mono)", color: "var(--lp-text-muted)" }}>
        {label} {required && <span style={{ color: "var(--lp-accent)" }}>*</span>}
      </span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        style={{ borderColor: "var(--lp-border)", background: "#fff", color: "var(--lp-dark)" }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: "var(--mono)", color: "var(--lp-text-muted)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        style={{ borderColor: "var(--lp-border)", background: "#fff", color: "var(--lp-dark)" }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function Textarea({
  label,
  required,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: "var(--mono)", color: "var(--lp-text-muted)" }}>
        {label} {required && <span style={{ color: "var(--lp-accent)" }}>*</span>}
      </span>
      <textarea
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2"
        style={{ borderColor: "var(--lp-border)", background: "#fff", color: "var(--lp-dark)" }}
      />
    </label>
  );
}

function Legend({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ fontFamily: "var(--mono)", color: "var(--lp-text-muted)" }}>
      {children} {required && <span style={{ color: "var(--lp-accent)" }}>*</span>}
    </legend>
  );
}
