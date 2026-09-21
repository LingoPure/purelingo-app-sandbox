/**
 * Server-rendered dark radar for the telemetry surfaces (A1/A2/A3). Same pure
 * geometry as gap-radar but fits the dark telemetry palette. No client deps.
 */
type Skill = { key: string; label: string; score: number | null; target: number };

const RING_VALUES = [200, 400, 600, 800, 1000];
const SCALE_MAX = 1000;
const CIRCLE = 2 * Math.PI;

function polarPoint(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

export function TRadar({ skills, size = 360 }: { skills: Skill[]; size?: number }) {
  const padding = 54;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - padding;
  const n = skills.length;
  const angles = skills.map((_, i) => -Math.PI / 2 + (i * CIRCLE) / n);

  const polygon = (values: number[]) =>
    values
      .map((v, i) => {
        const r = (Math.max(0, Math.min(SCALE_MAX, v)) / SCALE_MAX) * maxR;
        const p = polarPoint(cx, cy, r, angles[i]);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");

  const scoreValues = skills.map((s) => s.score ?? 0);
  const targetValues = skills.map((s) => s.target);
  const hasAnyScore = skills.some((s) => s.score != null);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full max-w-[380px]"
      role="img"
      aria-label="Radar of 6 communication capabilities against target"
    >
      {RING_VALUES.map((v) => {
        const r = (v / SCALE_MAX) * maxR;
        return (
          <polygon
            key={v}
            points={angles.map((a) => {
              const p = polarPoint(cx, cy, r, a);
              return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
            }).join(" ")}
            fill="none"
            stroke="#1d3447"
            strokeWidth={1}
          />
        );
      })}

      {angles.map((a, i) => {
        const p = polarPoint(cx, cy, maxR, a);
        return (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1d3447" strokeWidth={1} />
        );
      })}

      <polygon
        points={polygon(targetValues)}
        fill="none"
        stroke="#35c9ef"
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />

      {hasAnyScore && (
        <polygon
          points={polygon(scoreValues)}
          fill="#35c9ef"
          fillOpacity={0.18}
          stroke="#35c9ef"
          strokeWidth={1.5}
        />
      )}

      {/* An unassessed skill gets a distinct hollow/dashed marker rather than
          no marker — otherwise indistinguishable from a real zero (ISS-060). */}
      {skills.map((s, i) => {
        const p = polarPoint(cx, cy, ((s.score ?? 0) / SCALE_MAX) * maxR, angles[i]);
        if (s.score == null) {
          return (
            <circle
              key={`dot-${s.key}`}
              cx={p.x}
              cy={p.y}
              r={3.6}
              fill="none"
              stroke="#91a8b8"
              strokeWidth={1.25}
              strokeDasharray="2 2"
            >
              <title>{`${s.label}: not yet assessed`}</title>
            </circle>
          );
        }
        return (
          <circle key={`dot-${s.key}`} cx={p.x} cy={p.y} r={3.6} fill="#ff9f1c">
            <title>{`${s.label}: ${s.score}`}</title>
          </circle>
        );
      })}

      {skills.map((s, i) => {
        const p = polarPoint(cx, cy, maxR + 24, angles[i]);
        const anchor = Math.abs(p.x - cx) < 4 ? "middle" : p.x > cx ? "start" : "end";
        return (
          <text
            key={`label-${s.key}`}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fill="#91a8b8"
            fontSize={12}
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}