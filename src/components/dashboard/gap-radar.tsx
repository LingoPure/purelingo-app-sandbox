/**
 * Server-rendered SVG radar showing the 6 LingoPure sub-skill scores against
 * the student's target. No client deps. Pure geometry.
 *
 *   - 5 concentric polygons at 200/400/600/800/1000
 *   - solid filled polygon for the current scores
 *   - dashed polygon for the target line (default 800)
 *   - outer labels for each axis
 */

type Skill = { key: string; label: string; score: number | null; target: number };

type Props = {
  skills: Skill[];
  size?: number;
};

const RING_VALUES = [200, 400, 600, 800, 1000];
const SCALE_MAX = 1000;

function polarPoint(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function GapRadar({ skills, size = 360 }: Props) {
  const padding = 56;
  // Extra horizontal room reserved purely for axis-label text. SVG's UA
  // default is overflow:hidden on the root element, so any label extending
  // past the viewBox — e.g. "Live Interaction", the longest current label —
  // was being silently clipped at the edge (ISS-062). The circle geometry
  // itself is unchanged; it's just centred in a wider box.
  const labelMargin = 80;
  const width = size + labelMargin * 2;
  const cx = width / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - padding;
  const n = skills.length;

  // -π/2 puts the first axis at 12 o'clock; clockwise from there.
  const angles = skills.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / n);

  const buildPolygon = (values: number[]) =>
    values
      .map((v, i) => {
        const r = (Math.max(0, Math.min(SCALE_MAX, v)) / SCALE_MAX) * maxRadius;
        const p = polarPoint(cx, cy, r, angles[i]);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ");

  const scoreValues = skills.map((s) => s.score ?? 0);
  const targetValues = skills.map((s) => s.target);
  const hasAnyScore = skills.some((s) => s.score != null);

  return (
    <svg
      viewBox={`0 0 ${width} ${size}`}
      className="h-auto w-full"
      style={{ maxWidth: `${width}px` }}
      role="img"
      aria-label="Gap profile radar — scores across 6 sub-skills against target"
    >
      {/* Concentric reference rings */}
      {RING_VALUES.map((v) => {
        const r = (v / SCALE_MAX) * maxRadius;
        const points = angles
          .map((a) => {
            const p = polarPoint(cx, cy, r, a);
            return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          })
          .join(" ");
        return (
          <polygon
            key={v}
            points={points}
            fill="none"
            stroke="var(--color-cream)"
            strokeWidth={1}
          />
        );
      })}

      {/* Spokes */}
      {angles.map((a, i) => {
        const p = polarPoint(cx, cy, maxRadius, a);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-cream)"
            strokeWidth={1}
          />
        );
      })}

      {/* Target polygon (dashed) */}
      <polygon
        points={buildPolygon(targetValues)}
        fill="none"
        stroke="var(--color-navy)"
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />

      {/* Score polygon (filled) */}
      {hasAnyScore && (
        <polygon
          points={buildPolygon(scoreValues)}
          fill="var(--color-teal-soft)"
          fillOpacity={0.28}
          stroke="var(--color-teal)"
          strokeWidth={1.5}
        />
      )}

      {/* Score dots — an unassessed skill gets a distinct hollow/dashed
          marker rather than no marker at all. The filled polygon still
          passes through 0 for that axis (a true "no data" radar shape needs
          a redesign beyond this fix), but the marker itself now tells the
          viewer "not measured" instead of being indistinguishable from a
          real zero score with no marker shown (ISS-060). */}
      {skills.map((s, i) => {
        const r = ((s.score ?? 0) / SCALE_MAX) * maxRadius;
        const p = polarPoint(cx, cy, r, angles[i]);
        if (s.score == null) {
          return (
            <circle
              key={s.key}
              cx={p.x}
              cy={p.y}
              r={3.5}
              fill="none"
              stroke="var(--color-mute)"
              strokeWidth={1.25}
              strokeDasharray="2 2"
            >
              <title>{`${s.label}: not yet assessed`}</title>
            </circle>
          );
        }
        return (
          <circle key={s.key} cx={p.x} cy={p.y} r={3.5} fill="var(--color-teal)">
            <title>{`${s.label}: ${s.score}`}</title>
          </circle>
        );
      })}

      {/* Axis labels */}
      {skills.map((s, i) => {
        const labelRadius = maxRadius + 22;
        const p = polarPoint(cx, cy, labelRadius, angles[i]);
        // Anchor based on position so labels read naturally on each side.
        const anchor =
          Math.abs(p.x - cx) < 4
            ? "middle"
            : p.x > cx
            ? "start"
            : "end";
        return (
          <text
            key={s.key}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-mute font-mono"
            fontSize={10.5}
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}
