/**
 * Build-time canvas gate. Only "true" enables the annotation layer at all.
 * Plain module (no "use client") so both server and client components can
 * read it. NEXT_PUBLIC_* is inlined at build for both bundles.
 */
export const CANVAS_ENABLED = process.env.NEXT_PUBLIC_CANVAS_MODE === "true";
