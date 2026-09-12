// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
export function PageHeading({
  title,
  lead,
}: {
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-3xl text-navy">{title}</h1>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-mute">{lead}</p>
    </div>
  );
}