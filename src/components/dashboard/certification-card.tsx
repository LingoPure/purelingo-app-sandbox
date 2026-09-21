import Link from "next/link";
import { ScheduleCertButton } from "./schedule-cert-button";
import type { Eligibility } from "@/lib/tracktest/eligibility";

const SKILL_LABEL: Record<string, string> = {
  speaking: "speaking",
  listening: "listening",
  writing: "writing",
  reading: "reading",
  grammar: "grammar",
  live_interaction: "live interaction",
};

export type LatestCert = {
  id: string;
  level: string;
  status: string;
  issued_at: string | null;
} | null;

type Props = {
  eligibility: Eligibility;
  latestCert: LatestCert;
  /** ID of an in-progress (scheduled / in_progress) cert, if any. */
  pendingCertId: string | null;
};

export function CertificationCard({
  eligibility,
  latestCert,
  pendingCertId,
}: Props) {
  // Branch 1 — already certified at some level.
  if (latestCert?.status === "passed") {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-teal/30 bg-teal/5 p-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-teal">
            Certified · {latestCert.level}
          </p>
          <h3 className="mt-1 font-serif text-lg text-navy">
            CEFR {latestCert.level} certificate awarded
          </h3>
          <p className="mt-1 max-w-xl text-sm text-mute">
            {latestCert.issued_at
              ? `Issued ${new Date(latestCert.issued_at).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })}.`
              : "Recently issued."}{" "}
            {eligibility.ready === "C1" && latestCert.level !== "C1"
              ? "You're now eligible for the C1 level — aim higher."
              : "Keep pushing — every lesson re-tests against the next band."}
          </p>
        </div>
        <Link
          href={`/exam/${latestCert.id}`}
          className="rounded-md border border-teal/40 bg-paper px-4 py-2 text-sm font-medium text-navy hover:bg-mist"
        >
          View certificate
        </Link>
      </section>
    );
  }

  // Branch 2 — exam scheduled or in-progress.
  if (pendingCertId) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gold/30 bg-gold/5 p-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Exam scheduled
          </p>
          <h3 className="mt-1 font-serif text-lg text-navy">
            Your CEFR exam is ready to take
          </h3>
          <p className="mt-1 max-w-xl text-sm text-mute">
            45 minutes via TrackTest. Result returns to LingoPure automatically.
          </p>
        </div>
        <Link
          href={`/exam/${pendingCertId}`}
          className="rounded-md bg-navy px-5 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          Take exam →
        </Link>
      </section>
    );
  }

  // Branch 3 — ready to schedule.
  if (eligibility.ready) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gold/40 bg-gold/5 p-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Exam ready · {eligibility.ready}
          </p>
          <h3 className="mt-1 font-serif text-lg text-navy">
            You&apos;re cleared to sit the {eligibility.ready} CEFR exam
          </h3>
          <p className="mt-1 max-w-xl text-sm text-mute">
            Every sub-skill is at or above the {eligibility.ready} floor. Schedule
            it any time — internationally recognised certification.
          </p>
        </div>
        <ScheduleCertButton level={eligibility.ready} />
      </section>
    );
  }

  // Branch 4 — not yet ready, show what's blocking.
  return (
    <section className="rounded-lg border border-cream bg-paper p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
        On track for {eligibility.nextLevel}
      </p>
      <h3 className="mt-1 font-serif text-lg text-navy">
        Close these gaps to unlock the {eligibility.nextLevel} CEFR exam
      </h3>
      {eligibility.blockingSkills.length === 0 ? (
        <p className="mt-2 text-sm text-mute">
          Complete your discovery session — exam readiness depends on having
          scores on file.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {eligibility.blockingSkills.map((b) => (
            <li
              key={b.skill}
              className="rounded-full border border-coral/30 bg-coral/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-coral"
            >
              {SKILL_LABEL[b.skill] ?? b.skill} {b.score}/{b.floor}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
