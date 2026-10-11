/**
 * Canvas-based text measurer — the real `MeasureText` implementation the
 * brief asks for ("render off-screen or use canvas measureText"). Must use
 * the EXACT font-family string the renderer applies (see font-context.tsx)
 * or wrap points / highlight-circle geometry will drift from what's drawn.
 */
import type { MeasureText } from "@/lib/whiteboard/layout";

export function createCanvasMeasurer(fontFamily: string, fontSizePx = 18): MeasureText {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = `${fontSizePx}px ${fontFamily}`;
  if (ctx) ctx.font = font;

  const cache = new Map<string, number>();

  return (text, opts) => {
    const key = `${opts?.bold ? "b:" : ""}${text}`;
    const cached = cache.get(key);
    if (cached != null) return cached;

    let width: number;
    if (ctx) {
      ctx.font = opts?.bold ? `700 ${font}` : font;
      width = ctx.measureText(text).width;
    } else {
      // No canvas (shouldn't happen client-side) — a conservative fallback
      // so layout still produces something reasonable rather than throwing.
      width = text.length * (fontSizePx * 0.55);
    }
    cache.set(key, width);
    return width;
  };
}
