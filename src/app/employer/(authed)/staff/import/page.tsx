import Link from "next/link";
import { loadRolesIndex } from "@/lib/employer/roles-data";
import { ImportClient } from "./import-client";

export const dynamic = "force-dynamic";

export default async function StaffImportPage() {
  const roles = await loadRolesIndex();
  const roleNames = roles.map((r) => r.name);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/employer/students"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
        >
          ← Back to students
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-navy">Bulk staff import</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          Paste a CSV, or drop a file. Header row required:{" "}
          <code className="rounded bg-mist/40 px-1 font-mono text-xs">
            name,email,role,target_level,native_language
          </code>
          . The role column must match an existing role name (case-insensitive).{" "}
          <code className="rounded bg-mist/40 px-1 font-mono text-xs">
            target_level
          </code>{" "}
          is optional and defaults to B2.{" "}
          <code className="rounded bg-mist/40 px-1 font-mono text-xs">
            native_language
          </code>{" "}
          is optional too — accepts a 2-letter code (e.g.{" "}
          <code className="rounded bg-mist/40 px-1 font-mono text-xs">vi</code>,{" "}
          <code className="rounded bg-mist/40 px-1 font-mono text-xs">en</code>);
          when blank, falls back to your organisation&apos;s default.
        </p>
      </div>

      <section className="rounded-lg border border-cream bg-paper p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
          Available roles
        </p>
        {roleNames.length === 0 ? (
          <p className="text-sm text-coral">
            You have no roles configured.{" "}
            <Link href="/employer/roles/new" className="underline">
              Create one first
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {roleNames.map((n) => (
              <li
                key={n}
                className="rounded-full border border-cream bg-mist/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-navy"
              >
                {n}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ImportClient disabled={roleNames.length === 0} />
    </div>
  );
}
