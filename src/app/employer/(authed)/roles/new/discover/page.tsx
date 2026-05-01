import Link from "next/link";
import { DiscoverChat } from "./discover-chat";

export const dynamic = "force-dynamic";

export default function DiscoverRolePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles/new"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Choose a different path
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">
          Define a role with the AI consultant
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          A short conversation about what this role does in English. The
          consultant will pick a per-skill baseline based on your answers.
          You&apos;ll review and edit before saving.
        </p>
      </div>

      <DiscoverChat />
    </div>
  );
}
