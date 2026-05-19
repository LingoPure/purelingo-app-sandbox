// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NewRoleChoicePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to roles
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">New role</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Two ways to define a role. Use the AI consultant for the first pass
          on a new role — it interviews you, then generates a calibrated
          per-skill baseline you can edit. Drop into manual when you already
          know the numbers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/employer/roles/new/discover"
          className="group flex flex-col gap-3 rounded-lg border-2 border-navy bg-paper p-6 transition hover:bg-mist/30"
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
              Recommended
            </p>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy opacity-0 transition group-hover:opacity-100">
              Start →
            </span>
          </div>
          <h2 className="font-serif text-2xl text-navy">
            Interview with the AI consultant
          </h2>
          <p className="text-sm text-ink">
            Have a 5-minute chat about what this role does in English. The
            consultant asks focused questions about who they talk to, what
            they read and write, and what stakes their English carries — then
            generates per-skill baselines with a one-line rationale for each.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
            ~5 minutes · text chat · editable output
          </p>
        </Link>

        <Link
          href="/employer/roles/new/manual"
          className="group flex flex-col gap-3 rounded-lg border border-cream bg-paper p-6 transition hover:border-navy/50"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Faster
          </p>
          <h2 className="font-serif text-2xl text-navy">
            Set baselines manually
          </h2>
          <p className="text-sm text-ink">
            Six sliders, one per skill. Use this when you already know the
            numbers (e.g. you&apos;re cloning a role from another office).
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
            ~2 minutes · sliders · no AI
          </p>
        </Link>
      </div>
    </div>
  );
}
