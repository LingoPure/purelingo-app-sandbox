// @explanatory-header-exempt — auth surface (login / signup / password flows are self-explanatory by web convention)
import Link from "next/link";
import { loadDepartments } from "@/lib/employer/teachers-data";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const departments = await loadDepartments();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          LingoPure org
        </p>
        <h1 className="font-serif text-3xl text-navy">Departments</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          The academic departments inside LingoPure. Each has a head and a
          group of coaches. Provisional structure until the real org chart
          lands.
        </p>
      </div>

      {departments.length === 0 ? (
        <section className="rounded-lg border border-dashed border-cream bg-paper p-10 text-center">
          <p className="text-sm text-mute">
            No departments yet — re-run the seed.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {departments.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-lg border border-cream bg-paper p-6"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-serif text-xl text-navy">{d.name}</h2>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
                  {d.teacherCount} coach
                  {d.teacherCount === 1 ? "" : "es"}
                </p>
              </div>
              {d.focus && <p className="text-sm text-ink">{d.focus}</p>}
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">
                Head:{" "}
                <span className="text-ink">
                  {d.headTeacherName ?? "— no head assigned —"}
                </span>
              </p>
              <Link
                href="/employer/teachers"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:underline"
              >
                See all teachers →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
