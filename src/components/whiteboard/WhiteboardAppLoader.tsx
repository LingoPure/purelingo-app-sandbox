/**
 * Client-only loader for WhiteboardApp.
 *
 * WhiteboardApp's layout engine needs a real canvas 2D context to measure
 * text (see measure.ts) — there is no sensible SSR render of it, and
 * Next still server-renders "use client" components for the initial paint,
 * which threw `ReferenceError: document is not defined`. `next/dynamic`'s
 * `ssr: false` fixes this correctly (skip the server render entirely)
 * rather than papering over it with environment-check guards scattered
 * through the canvas code — but `ssr: false` is only permitted inside a
 * Client Component, which is the entire reason this one-line wrapper
 * exists: page.tsx stays a Server Component (cheap flag-gate + validation
 * + font loading) and only this leaf opts out of SSR.
 */
"use client";

import dynamic from "next/dynamic";
import type { LessonScript } from "@/lib/whiteboard/schema";

const WhiteboardApp = dynamic(
  () => import("@/components/whiteboard/WhiteboardApp").then((m) => m.WhiteboardApp),
  {
    ssr: false,
    loading: () => <p className="text-sm text-mute">Loading whiteboard…</p>,
  }
);

export function WhiteboardAppLoader({
  script,
  fontFamily,
}: {
  script: LessonScript;
  fontFamily: string;
}) {
  return <WhiteboardApp script={script} fontFamily={fontFamily} />;
}
