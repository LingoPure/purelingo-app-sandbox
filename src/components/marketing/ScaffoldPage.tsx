import { getDict } from "@/lib/i18n";
import { SpecProvider } from "./SpecProvider";
import { CanvasBar, ViewToggle } from "./CanvasChrome";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { EmptySlot, StatusPill } from "./AnnotationLayer";
import type { Annotation } from "@/content/types";

/**
 * Scaffold page shell for the route stubs (/for-companies,
 * /for-individuals, /method, /book-a-demo). Real chrome + an explanatory
 * header, with the page body rendered as an honest empty slot until its
 * content is built. No invented copy.
 */
export async function ScaffoldPage({
  title,
  intro,
  annotation,
}: {
  title: string;
  intro: string;
  annotation: Annotation;
}) {
  const { lang, t } = await getDict();
  return (
    <SpecProvider>
      <CanvasBar />
      <ViewToggle />
      <Nav t={t} lang={lang} />
      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-4 flex items-center gap-3">
            <h1 className="font-serif text-4xl text-navy sm:text-5xl">{title}</h1>
            <StatusPill status="pending" />
          </div>
          <p className="max-w-2xl text-lg text-mute">{intro}</p>
          <div className="mt-10">
            <EmptySlot annotation={annotation} minHeight="16rem" />
          </div>
        </section>
      </main>
      <Footer t={t} />
    </SpecProvider>
  );
}
