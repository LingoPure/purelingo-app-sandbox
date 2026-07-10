import Link from "next/link";
import { getContentEditor } from "@/lib/content/auth";

/**
 * Content-admin landing. Explains the surface and routes to the two areas.
 * (The layout already gated on a content role, so `editor` is non-null.)
 */
export default async function AdminHome() {
  const editor = await getContentEditor();
  const isAdmin = editor?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-gold">
        Content admin
      </p>
      <h1 className="mt-2 font-serif text-3xl text-navy">Edit the marketing site</h1>
      <p className="mt-3 max-w-prose text-mute">
        Change the marketing site&apos;s copy directly — no developer, no deploy.
        You are signed in as <strong className="text-navy">{editor?.role}</strong>.
        Content editing touches only the marketing content; it can never reach
        learner data, scores or session records.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/content"
          className="rounded-lg border border-cream bg-paper p-6 transition hover:border-navy/30 hover:shadow-sm"
        >
          <h2 className="font-serif text-xl text-navy">Content</h2>
          <p className="mt-2 text-sm text-mute">
            Edit copy block by block, with English and Vietnamese side by side,
            and set each block&apos;s status.
          </p>
        </Link>
        {isAdmin ? (
          <Link
            href="/admin/editors"
            className="rounded-lg border border-cream bg-paper p-6 transition hover:border-navy/30 hover:shadow-sm"
          >
            <h2 className="font-serif text-xl text-navy">Editors</h2>
            <p className="mt-2 text-sm text-mute">
              Invite marketing and read-only editors, and manage their roles.
            </p>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
