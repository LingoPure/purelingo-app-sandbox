// @explanatory-header-exempt — nested workflow page; entry-point header lives on the parent surface
import Link from "next/link";
import { VoiceInterview } from "./voice-interview";

export const dynamic = "force-dynamic";

export default function VoiceDiscoverRolePage() {
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
          Define a role with Aria
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          A short voice call about what this role does in English. Aria asks
          focused questions about who they talk to, what they read and
          write, and what&rsquo;s at stake when the English goes wrong — then
          sets per-skill baselines with a one-line rationale for each.
          You&rsquo;ll land on the role&rsquo;s page to review and tweak before
          anyone is assessed against it.
        </p>
      </div>

      <VoiceInterview />
    </div>
  );
}
