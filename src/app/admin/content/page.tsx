import { home } from "@/content/home";

/**
 * Content overview. Row-backed inline editing (edit copy + EN/VI + status per
 * block) is the next build step; for now this shows the section/status map so
 * an editor sees the model. The pending-semantics note is deliberate and stays.
 */
const SECTIONS: { key: string; status: string }[] = [
  { key: "Hero", status: home.hero.anno.status },
  { key: "Trust band", status: home.trust.anno.status },
  { key: "Problem", status: home.problem.anno.status },
  { key: "Audience fork", status: home.fork.anno.status },
  { key: "How it works", status: home.how.anno.status },
  { key: "Proof", status: home.proof.anno.status },
  { key: "Outcomes", status: home.outcomes.anno.status },
  { key: "Testimonials", status: home.testimonials.anno.status },
  { key: "Objections", status: home.objections.anno.status },
  { key: "Final CTA", status: home.final.anno.status },
];

const STATUS_STYLE: Record<string, string> = {
  ready: "bg-ai-green/10 text-ai-green",
  confirm: "bg-gold/10 text-gold",
  pending: "bg-coral/10 text-coral",
};

export default function AdminContentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">Content</p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Marketing homepage</h1>
      <p className="mt-3 max-w-prose text-mute">
        The ten sections of the marketing homepage and their current status. Inline
        editing (copy, English/Vietnamese, and status per block) is the next step;
        this view shows the content model editors will work in.
      </p>
      <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-navy">
        A <strong>pending</strong> block is <em>intentionally empty</em> — its copy
        must come from customer research. Filling it with invented copy defeats its
        purpose; move it to <strong>confirm</strong> only when real copy exists.
      </div>

      <ul className="mt-6 divide-y divide-cream rounded-lg border border-cream bg-paper">
        {SECTIONS.map((s) => (
          <li key={s.key} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-navy">{s.key}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                STATUS_STYLE[s.status] ?? "bg-mist text-mute"
              }`}
            >
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
