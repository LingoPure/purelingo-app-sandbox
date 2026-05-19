// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { ReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

export default function DiscoverReviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/roles/new/discover"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to interview
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">
          Review the role profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          The consultant&apos;s draft is below. Edit anything that doesn&apos;t
          match — every baseline number is a slider you can nudge. Save when
          it looks right.
        </p>
      </div>

      <ReviewClient />
    </div>
  );
}
