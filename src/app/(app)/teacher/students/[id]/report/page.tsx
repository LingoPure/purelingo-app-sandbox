// @explanatory-header-exempt — nested report surface; entry-point chrome lives on the teacher portal
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCompletedAssessments, loadAssessmentPipeline, canViewStudent } from "@/lib/2k/journey-data";
import { buildTeacherIntelligenceView } from "@/lib/2k/teacher-intelligence";
import { buildEvidencePackets } from "@/lib/2k/engines/evidence-packet-builder";
import { ScoreRing } from "@/components/telemetry/score-ring";
import "@/components/telemetry/telemetry.css";

const BAND_COLORS: Record<string, string> = {
  Survival: "#ff6575",
  Functional: "#ff9f1c",
  Professional: "#f6c344",
  "Stable Professional": "#35c9ef",
  "Executive Stability": "#80d84d",
  "Strategic Mastery": "#a879ff",
};

const ARCHETYPE_COLOR: Record<string, string> = {
  CAPABILITY: "#ff9f1c",
  AUTOMATICITY: "#ff9f1c",
  TRANSFER: "#35c9ef",
  CONTRADICTION_CONFLICT: "#ff6575",
  COGNITIVE_OVERLOAD: "#a879ff",
  HIERARCHY_PRESSURE: "#a879ff",
  PROGRESSION: "#80d84d",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function resolveStudentView(supabase: Supabase, studentId: string) {
  // Student row — self-read via RLS is unconditional; org/teacher visibility is
  // resolved by the org_can_view_student gate (0038) via the gated loader.
  const { data: student } = await supabase
    .from("students")
    .select("id, name, target_level, native_language, xp, streak_days")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return null;

  const viewerCanRead = await canViewStudent(supabase, studentId);

  // Strict RLS gate: listCompletedAssessments short-circuits to [] when the
  // viewer cannot read this learner, so no assessment row is even queried.
  const completed = await listCompletedAssessments(supabase, studentId, 40, {
    canView: viewerCanRead,
  });
  return { student, viewerCanRead, completed };
}

export default async function TeacherReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const view = await resolveStudentView(supabase, id);
  if (!view) notFound();

  const { student, viewerCanRead, completed } = view;

  // Load newest→oldest frozen results so "latest" is the first element.
  const results = [];
  if (viewerCanRead) {
    for (const summary of completed) {
      const pipeline = await loadAssessmentPipeline(supabase, summary.assessment_id, {
        canView: viewerCanRead,
      });
      if (pipeline) results.push(pipeline);
    }
  }
  const latest = results[0] ?? null;
  const report = latest ? buildTeacherIntelligenceView(latest.result) : null;

  // Rebuild the governed evidence packets from the raw analyses the frozen
  // result was built from (C08 is deterministic per-analysis; ids are fresh
  // but the construct/status/authority/confidence surface matches the run).
  const evidencePackets =
    latest && latest.analyses.length
      ? (await Promise.all(latest.analyses.map((analysis) => buildEvidencePackets(analysis)))).flat()
      : [];

  const packetStatusCounts = evidencePackets.reduce<Record<string, number>>((counts, packet) => {
    counts[packet.status] = (counts[packet.status] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="telemetry min-h-screen p-4 pb-12 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="t-eyebrow t-eyebrow-purple">Master Brain · Teacher view</p>
          <h1 className="mt-1 font-serif text-2xl text-t-soft sm:text-3xl">
            {student.name} — communication intelligence
          </h1>
          <p className="t-muted mt-1">
            Deep per-student diagnostic, telemetry, decision trace and lineage.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-pill">Target {student.target_level}</span>
          <span className="t-pill">
            {student.native_language ?? "en"} · {results.length} assessment{results.length === 1 ? "" : "s"}
          </span>
          <Link
            href={`/employer/students/${id}`}
            className="rounded-lg border border-t-line px-3 py-2 text-xs font-medium text-t-soft-mute hover:border-t-cyan hover:text-t-text"
          >
            ← Student dashboard
          </Link>
        </div>
      </div>

      {!viewerCanRead && (
        <div className="mx-auto mt-8 max-w-6xl rounded-lg border border-t-red/40 bg-[rgba(255,101,117,0.07)] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-t-red">
            Access restricted
          </p>
          <p className="t-muted mt-2">
            You are not this student, and your organisation role does not yet expose this
            student&apos;s data. Assessment-level scoping is wired in this phase&apos;s org layer.
          </p>
        </div>
      )}

      {viewerCanRead && !latest && (
        <div className="mx-auto mt-8 max-w-6xl rounded-lg border border-t-line bg-t-panel p-6">
          <p className="t-eyebrow">Assessment run</p>
          <p className="t-muted mt-2">No completed 2K assessment found for this student yet.</p>
        </div>
      )}

      {viewerCanRead && latest && report && (
        <>
          {/* 1 · ASSESSMENT RUN */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow-green t-eyebrow">1 · Assessment run</p>
            <h2 className="t-h2 mt-1">Canonical result, evidence & completion</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              <article className="t-card flex items-center gap-4 p-5">
                <div className="t-score-ring h-[92px] w-[92px]">
                  <ScoreRing score={latest.result.lp1000.score} size={92} color={BAND_COLORS[latest.result.lp1000.band] ?? "#35c9ef"} />
                </div>
                <div>
                  <strong className="text-2xl font-extrabold">{latest.result.lp1000.score}</strong>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-t-mute">LP-1000</p>
                  <span className="t-pill t-pill-good mt-2">{latest.result.lp1000.band}</span>
                </div>
              </article>

              <article className="t-card p-5">
                <p className="t-eyebrow t-eyebrow-orange">Coverage</p>
                <div className="mt-3 space-y-1 text-sm text-t-soft-mute">
                  <p>{latest.result.coverage.answered} / {latest.result.coverage.total_questions} answered</p>
                  <p>{latest.result.coverage.coverage_pct}% coverage</p>
                  <p>{latest.result.coverage.with_audio} with audio</p>
                  <p>{latest.result.coverage.with_transcript} transcribed</p>
                </div>
              </article>

              <article className="t-card p-5">
                <p className="t-eyebrow t-eyebrow-purple">Evidence</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-t-green">✓ {report.evidence_summary.accepted} accepted</span>
                  <span className="text-t-red">✗ {report.evidence_summary.rejected} rejected</span>
                  <span className="text-t-mute">↧ {report.evidence_summary.downweighted} downweighted</span>
                  <span className="text-t-text">{report.evidence_summary.total_evidence} total</span>
                </div>
                <p className="mt-3 text-[11px] text-t-mute">
                  frozen {latest.result.frozen_at}
                </p>
              </article>

              <article className="t-card p-5">
                <p className="t-eyebrow t-eyebrow-orange">Confidence</p>
                <strong className="mt-3 block text-2xl font-extrabold">
                  {(latest.result.confidence * 100).toFixed(0)}%
                </strong>
                <div className="t-progress mt-3">
                  <i style={{ width: `${Math.round(latest.result.confidence * 100)}%` }} />
                </div>
                <p className="mt-3 text-[11px] text-t-mute">convergence {(latest.result.telemetry.convergence * 100).toFixed(0)}%</p>
              </article>
            </div>
          </section>

          {/* 2 · 12D TELEMETRY + TRAJECTORY */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow t-eyebrow-purple">2 · 12D telemetry + temporal state</p>
            <h2 className="t-h2 mt-1">The measured signals behind the score</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className="t-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="t-eyebrow t-eyebrow-orange">Telemetry grid</p>
                  <span className="t-pill">drift {(latest.result.telemetry.drift * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-4">
                  {report.telemetry.map((d) => (
                    <div key={d.name} className="t-dim">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-t-soft-mute">{d.name.replace(/_/g, " ")}</span>
                        <span className="text-xs font-bold text-t-text">
                          {(d.score * 100).toFixed(0)}%
                          <span className="font-normal text-t-mute"> · conf {(d.confidence * 100).toFixed(0)}</span>
                        </span>
                      </div>
                      <div className="t-dim-bar">
                        <i style={{ width: `${Math.round(d.score * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <div className="flex flex-col gap-4">
                <article className="t-card p-6">
                  <p className="t-eyebrow-green t-eyebrow">LP-1000 components</p>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                    {Object.entries(latest.result.lp1000.components).map(([key, value]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-t-mute">{key.replace(/_/g, " ")}</span>
                          <span className="text-xs font-bold">{Math.round(value)}</span>
                        </div>
                        <div className="t-progress mt-1">
                          <i style={{ width: `${Math.round(value / 10)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="t-card-deep t-card p-6">
                  <p className="t-eyebrow t-eyebrow-orange">Working (provisional) state</p>
                  <ul className="mt-3 space-y-1 text-sm text-t-soft-mute">
                    {latest.result.lp18.working.micro_levels.slice(0, 6).map((m) => (
                      <li key={m.capability} className="flex justify-between">
                        <span>{m.capability.replace(/_/g, " ")}</span>
                        <span className="text-t-text">L{m.level} · {m.evidence_count} ev</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </div>
          </section>

          {/* 3 · DIAGNOSIS & RECOMMENDATION */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow-green t-eyebrow">3 · Diagnosis & recommendation</p>
            <h2 className="t-h2 mt-1">Why the score is where it is, and what to prescribe</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <article className="t-card p-6">
                <span
                  className="t-pill"
                  style={{ borderColor: `${ARCHETYPE_COLOR[report.diagnosis.archetype] ?? "#35c9ef"}55`, color: ARCHETYPE_COLOR[report.diagnosis.archetype] ?? "#35c9ef" }}
                >
                  {report.diagnosis.archetype.replace(/_/g, " ")}
                </span>
                <h3 className="mt-3 text-lg font-bold">Gap origin</h3>
                <p className="t-muted mt-2">{report.diagnosis.gap_origin}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-t-mute">Diagnosis confidence</span>
                  <span className="text-xs font-bold">{(report.diagnosis.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="t-progress mt-2">
                  <i style={{ width: `${Math.round(report.diagnosis.confidence * 100)}%` }} />
                </div>
              </article>

              <article className="t-card p-6">
                <span className="t-pill t-pill-good">Family {report.recommendation.family}</span>
                <h3 className="mt-3 text-lg font-bold">{report.recommendation.exposure}</h3>
                <p className="t-muted mt-2">
                  Priority {(report.recommendation.priority * 100).toFixed(0)}/100
                </p>
                {report.recommendation.next_probe && (
                  <p className="t-muted mt-2 text-[11px]">Next probe: {report.recommendation.next_probe}</p>
                )}
                <div className="t-progress mt-4">
                  <i style={{ width: `${Math.round(report.recommendation.priority * 100)}%` }} />
                </div>
              </article>
            </div>
          </section>

          {/* 4 · DECISION TRACE */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow t-eyebrow-purple">4 · Assessment decision trace</p>
            <h2 className="t-h2 mt-1">Recent engine decisions and why</h2>
            <article className="t-card mt-4 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-t-line bg-[#0b1a27] p-4">
                  <span className="t-pill t-pill-good">Architecture frozen</span>
                  <p className="mt-2 text-[11px] leading-relaxed text-t-mute">
                    {latest.result.architecture.brain_version} · bank {latest.result.architecture.bank_version} ·
                    rules {latest.result.architecture.rules_version} · report {latest.result.architecture.report_version}
                  </p>
                </div>
                <div className="rounded-lg border border-t-line bg-[#0b1a27] p-4">
                  <span className="t-pill t-pill-warn">Lineage</span>
                  <p className="mt-2 text-[11px] leading-relaxed text-t-mute">
                    assessment {latest.result.lineage.assessment_id} · session {latest.result.lineage.session_id}
                  </p>
                </div>
              </div>
              {latest.result.contradictions.length > 0 && (
                <div className="mt-4 border-t border-t-line pt-4">
                  <p className="t-eyebrow t-eyebrow-red mb-2">Contradictions in evidence</p>
                  {latest.result.contradictions.map((c, i) => (
                    <p key={i} className="t-muted text-[11px]">
                      [{c.severity}] {c.description}
                    </p>
                  ))}
                </div>
              )}
            </article>
          </section>

          {/* 5 · AUDIT / LINEAGE / SNAPSHOT */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow t-eyebrow-orange">5 · Audit, lineage & snapshot</p>
            <h2 className="t-h2 mt-1">Version-pinned, immutable, reproducible</h2>
            <article className="t-card mt-4 p-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Assessment", latest.result.assessment_id],
                  ["Result", latest.result.result_id],
                  ["Learner", latest.result.learner_id],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-t-mute">{k}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-t-soft-mute" title={v}>
                      {v}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-t-line pt-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-t-mute">Stable certified bands</p>
                <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-t-soft-mute sm:grid-cols-2">
                  {latest.result.lp18.stable.micro_levels.map((m) => (
                    <li key={m.capability} className="flex justify-between">
                      <span>{m.capability.replace(/_/g, " ")}</span>
                      <span className="text-t-text">{m.certified_level} · {m.transition_count} transitions</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </section>

          {/* 6 · EVIDENCE PACKETS */}
          <section className="mx-auto mt-8 max-w-6xl">
            <p className="t-eyebrow t-eyebrow-green">6 · Evidence packets</p>
            <h2 className="t-h2 mt-1">Every governed signal the engine adjudicated</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="t-pill">Total {evidencePackets.length}</span>
              {Object.entries(packetStatusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className={`t-pill ${
                    status === "OBSERVED" ? "t-pill-good" : status === "NOT_OBSERVED" || status === "ZERO" ? "t-pill-warn" : ""
                  }`}
                >
                  {status.replace(/_/g, " ")} {count}
                </span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {evidencePackets.map((packet) => (
                <article key={packet.evidence_id} className="t-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] tracking-wide text-t-cyan">
                      {packet.construct}
                    </span>
                    <span className={`t-pill ${packet.status === "OBSERVED" ? "t-pill-good" : ""}`}>
                      {packet.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-t-soft-mute">{packet.observation}</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-t-mute">
                    <span>authority {packet.authority}</span>
                    <span>confidence {(packet.confidence * 100).toFixed(0)}%</span>
                    <span>task relevance {(packet.task_relevance * 100).toFixed(0)}%</span>
                    <span>quality {(packet.quality * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-t-line pt-2 font-mono text-[10px] text-t-mute">
                    <span>{packet.source.modality}</span>
                    <span className="truncate" title={packet.source.response_id}>
                      {packet.source.response_id}
                    </span>
                    <span>{packet.provenance.engine_version}</span>
                  </div>
                  {packet.context_receiver.receiver && (
                    <p className="mt-1 font-mono text-[10px] text-t-mute">
                      → {packet.context_receiver.receiver}
                      {packet.context_receiver.context ? ` · ${packet.context_receiver.context}` : ""}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}