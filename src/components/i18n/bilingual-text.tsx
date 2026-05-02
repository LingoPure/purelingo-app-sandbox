import type { Bilingual } from "@/lib/i18n/translate";

/**
 * Render a Bilingual pair: native primary, English as deliberate
 * cross-reading practice below. When the student's native language IS
 * English (or translation fell through), only the English is shown.
 *
 * Use this for student-facing dynamic content (gap-score evidence,
 * lesson-plan rationales). Don't use it for static UI chrome — that
 * goes through the dictionary in src/lib/i18n/dictionary.ts.
 */
export function BilingualText({
  text,
  className,
  englishLabel,
}: {
  text: Bilingual;
  className?: string;
  /** Optional small label rendered before the English line so the
   *  student sees explicitly that it's the original. */
  englishLabel?: string;
}) {
  if (!text.translated) {
    return <p className={className}>{text.en}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <p className={className}>{text.native}</p>
      <p className="text-xs italic text-mute">
        {englishLabel ? <span className="not-italic">{englishLabel}: </span> : null}
        {text.en}
      </p>
    </div>
  );
}
