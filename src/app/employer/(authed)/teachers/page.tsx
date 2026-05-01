import Link from "next/link";
import { loadTeachers } from "@/lib/employer/teachers-data";

export const dynamic = "force-dynamic";

const EMPLOYMENT_LABEL: Record<string, string> = {
  in_house: "In-house",
  contractor: "Contractor",
  ai_tutor: "AI tutor",
};

export default async function TeachersPage() {
  const teachers = await loadTeachers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">
          LingoPure coaching staff
        </p>
        <h1 className="font-serif text-3xl text-navy">Teachers</h1>
        <p className="mt-2 max-w-2xl text-sm text-mute">
          The coaches your students are paired with. Includes in-house staff,
          contracted coaches, and the AI tutor track. Provisional org chart
          until LingoPure confirms the real structure.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-cream bg-paper">
        {teachers.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-mute">
            No teachers yet — re-run the seed to populate.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-cream bg-mist/50 text-left">
              <tr>
                <Th>Teacher</Th>
                <Th>Departments</Th>
                <Th>Type</Th>
                <Th>ClassIn</Th>
                <Th className="text-center">Students</Th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-cream last:border-b-0 hover:bg-mist/40"
                >
                  <Td>
                    <Link
                      href={`/employer/teachers/${t.id}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {t.fullName}
                    </Link>
                    <p className="font-mono text-[10px] text-mute">{t.email}</p>
                  </Td>
                  <Td>
                    <ul className="flex flex-col gap-0.5">
                      {t.departments.length === 0 ? (
                        <li className="text-xs text-mute">—</li>
                      ) : (
                        t.departments.map((d) => (
                          <li key={d.id} className="text-xs text-ink">
                            {d.isHead && (
                              <span className="mr-1 rounded-full bg-gold/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-gold">
                                Head
                              </span>
                            )}
                            {d.name}
                          </li>
                        ))
                      )}
                    </ul>
                  </Td>
                  <Td>
                    <Pill tone={t.employmentType}>
                      {EMPLOYMENT_LABEL[t.employmentType] ?? t.employmentType}
                    </Pill>
                  </Td>
                  <Td>
                    {t.classinAccountId ? (
                      <span className="font-mono text-[11px] text-mute">
                        {t.classinAccountId}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-mute">—</span>
                    )}
                  </Td>
                  <Td className="text-center font-mono text-sm">
                    {t.studentCount}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-mute ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 align-top text-ink ${className}`}>{children}</td>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: string;
}) {
  const styles =
    tone === "ai_tutor"
      ? "border-teal/30 bg-teal/5 text-teal"
      : tone === "contractor"
      ? "border-gold/30 bg-gold/5 text-gold"
      : "border-cream bg-mist/40 text-navy";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${styles}`}
    >
      {children}
    </span>
  );
}
