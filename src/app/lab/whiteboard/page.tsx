import { notFound } from "next/navigation";
import { Caveat } from "next/font/google";
import { validateLessonScript } from "@/lib/whiteboard/validate";
import type { LessonScript } from "@/lib/whiteboard/schema";
import { WhiteboardAppLoader } from "@/components/whiteboard/WhiteboardAppLoader";
import lessonJson from "@/content/lessons/repair-reformulation.json";

export const metadata = {
  title: "Whiteboard lesson prototype — LingoPure lab",
  robots: { index: false, follow: false, nocache: true },
};

// Caveat is the body handwriting font; Kalam is the brief's named
// alternative to try later (swap the import if you want to A/B the look —
// deliberately not loading both to keep the font payload to one family).
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  fallback: ["cursive"],
});

export default function WhiteboardLabPage() {
  if (process.env.NEXT_PUBLIC_LAB_WHITEBOARD !== "true") {
    notFound();
  }

  const result = validateLessonScript(lessonJson);
  if (!result.ok) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 font-serif text-2xl text-coral">
          Static lesson failed validation
        </h1>
        <p className="mb-4 text-sm text-mute">
          content/lessons/repair-reformulation.json was rejected rather than silently fixed. Fix
          the errors below and reload:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
          {result.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <WhiteboardAppLoader script={lessonJson as LessonScript} fontFamily={caveat.style.fontFamily} />
    </main>
  );
}
