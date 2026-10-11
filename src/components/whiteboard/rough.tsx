/**
 * Thin React wrapper over roughjs's imperative SVG API.
 *
 * rough.js builds plain SVG DOM nodes via `rough.svg(svgRoot)` — it has no
 * declarative/React API, so this hook does the escape-hatch dance once:
 * generate the node in an effect, mount it into a ref'd <g>, clean up on
 * every re-render. A fixed numeric `seed` (derived deterministically from
 * the element's own id, never Math.random) is required by every caller so
 * strokes don't re-randomise on re-render, per the brief.
 */
"use client";

import { useEffect, useRef } from "react";
import rough from "roughjs";
import type { Options as RoughOptions } from "roughjs/bin/core";

/** Deterministic string → positive int, stable across runs/platforms. */
export function seedFrom(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 2147483647) || 1;
}

type RoughShape =
  | { kind: "ellipse"; x: number; y: number; width: number; height: number }
  | { kind: "rectangle"; x: number; y: number; width: number; height: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number };

export function RoughNode({
  shape,
  seed,
  options,
  className,
}: {
  shape: RoughShape;
  seed: number;
  options?: Omit<RoughOptions, "seed">;
  className?: string;
}) {
  const groupRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const svgRoot = group.ownerSVGElement;
    if (!svgRoot) return;

    const rc = rough.svg(svgRoot);
    const resolved: RoughOptions = { seed, roughness: 1.6, ...options };

    let node: SVGElement;
    if (shape.kind === "ellipse") {
      node = rc.ellipse(
        shape.x + shape.width / 2,
        shape.y + shape.height / 2,
        shape.width,
        shape.height,
        resolved
      );
    } else if (shape.kind === "rectangle") {
      node = rc.rectangle(shape.x, shape.y, shape.width, shape.height, resolved);
    } else {
      node = rc.line(shape.x1, shape.y1, shape.x2, shape.y2, resolved);
    }

    while (group.firstChild) group.removeChild(group.firstChild);
    group.appendChild(node);

    return () => {
      while (group.firstChild) group.removeChild(group.firstChild);
    };
    // Re-draw only when the shape's own geometry/options identity changes —
    // JSON.stringify is fine at this scale (a handful of marks per board).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(shape), seed, JSON.stringify(options)]);

  return <g ref={groupRef} className={className} />;
}
