import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { readTracktestCredentials, buildSsoUrl } from "@/lib/tracktest/sso";
import { ExamRunner } from "./exam-runner";

type CertRow = {
  id: string;
  student_id: string;
  level: string;
  status: string;
  tracktest_exam_id: string | null;
  result_json: {
    overall_score?: number;
    floor?: number;
    passed?: boolean;
    note?: string;
    simulated?: boolean;
  } | null;
  issued_at: string | null;
};

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/exam/${id}`);

  const { data: cert } = await supabase
    .from("certifications")
    .select(
      "id, student_id, level, status, tracktest_exam_id, result_json, issued_at"
    )
    .eq("id", id)
    .maybeSingle<CertRow>();
  if (!cert) notFound();

  const completed = cert.status === "passed" || cert.status === "failed";
  const creds = readTracktestCredentials();

  // Real TrackTest path — render the SSO iframe when creds exist and exam
  // is not yet complete. Today this only happens on a deployment where
  // someone has wired TRACKTEST_API_KEY + TRACKTEST_PARTNER_ID.
  if (!completed && creds) {
    const ssoUrl = buildSsoUrl({
      studentId: cert.student_id,
      examLevel: cert.level as "B1" | "B2" | "C1",
      certificationId: cert.id,
    });
    return (
      <iframe
        src={ssoUrl}
        title={`TrackTest ${cert.level} exam`}
        className="h-screen w-screen border-0"
        allow="camera; microphone; fullscreen"
      />
    );
  }

  // Demo path / completed path.
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <Link
        href="/dashboard"
        className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute hover:text-navy"
      >
        ← Dashboard
      </Link>

      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">
          TrackTest CEFR exam
        </p>
        <h1 className="font-serif text-3xl text-navy">
          {cert.level} certification
        </h1>
      </div>

      {!completed && (
        <>
          <div className="rounded-lg border border-cream bg-paper p-6">
            <p className="text-sm text-mute">
              In production this is a 45-minute TrackTest CEFR exam in a separate
              window via SSO. The demo runs a synthetic result based on your
              current gap profile so you can walk the certification flow end to
              end without the partner agreement.
            </p>
          </div>
          <ExamRunner certId={cert.id} level={cert.level} />
        </>
      )}

      {completed && cert.result_json && (
        <ResultPanel
          level={cert.level}
          status={cert.status}
          result={cert.result_json}
          issuedAt={cert.issued_at}
        />
      )}
    </div>
  );
}

function ResultPanel({
  level,
  status,
  result,
  issuedAt,
}: {
  level: string;
  status: string;
  result: NonNullable<CertRow["result_json"]>;
  issuedAt: string | null;
}) {
  const passed = status === "passed";
  return (
    <div className="flex flex-col gap-4">
      <div
        className={
          passed
            ? "rounded-lg border border-teal/30 bg-teal/5 p-6"
            : "rounded-lg border border-coral/30 bg-coral/5 p-6"
        }
      >
        <p
          className={
            passed
              ? "font-mono text-[11px] uppercase tracking-[0.22em] text-teal"
              : "font-mono text-[11px] uppercase tracking-[0.22em] text-coral"
          }
        >
          {passed ? "Pass" : "Did not pass"}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-navy">
          {passed
            ? `${level} certification awarded`
            : `${level} attempt — try again when ready`}
        </h2>
        {result.overall_score !== undefined && (
          <p className="mt-2 font-mono text-sm text-mute">
            Score {result.overall_score}/100 · floor {result.floor}/100
          </p>
        )}
        {result.note && (
          <p className="mt-2 text-sm text-ink">{result.note}</p>
        )}
        {issuedAt && passed && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Issued{" "}
            {new Date(issuedAt).toLocaleDateString("en-AU", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        )}
      </div>

      {passed && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-6 text-center">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-gold">
            LingoPure × TrackTest
          </p>
          <h3 className="font-serif text-3xl text-navy">{level}</h3>
          <p className="mt-2 text-sm text-mute">
            Internationally recognised CEFR certification
          </p>
        </div>
      )}

      <Link
        href="/dashboard"
        className="self-start rounded-md bg-navy px-5 py-2 text-sm font-medium text-paper hover:bg-navy-deep"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
