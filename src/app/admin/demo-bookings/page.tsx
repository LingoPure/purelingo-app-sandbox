import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "../page-heading";

type Booking = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  email: string;
  company: string;
  industry: string | null;
  company_size: string | null;
  target_learners: number | null;
  status: string;
  preferred_date: string | null;
  preferred_time: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  demo_scheduled: "bg-green-100 text-green-800",
  proposal_sent: "bg-purple-100 text-purple-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function AdminDemoBookingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("demo_bookings")
    .select("id, first_name, last_name, job_title, email, company, industry, company_size, target_learners, status, preferred_date, preferred_time, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <PageHeading title="Demo bookings" lead="Could not load demo bookings." />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold">Failed to load bookings</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const bookings = (data ?? []) as Booking[];

  return (
    <div>
      <PageHeading
        title="Demo bookings"
        lead="Corporate proposal intake requests. Each row is a senior decision-maker who submitted their org details for a staff-led walkthrough."
      />

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <Th>Company</Th>
              <Th>Contact</Th>
              <Th>Title</Th>
              <Th>Industry</Th>
              <Th>Size</Th>
              <Th>Learners</Th>
              <Th>Demo date</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-mist/40">
                <td className="px-4 py-3 font-semibold text-ink">{b.company}</td>
                <td className="px-4 py-3">
                  <div>{b.first_name} {b.last_name}</div>
                  <div className="text-xs text-mute">{b.email}</div>
                </td>
                <td className="px-4 py-3 text-mute">{b.job_title ?? "—"}</td>
                <td className="px-4 py-3 text-mute">{b.industry ?? "—"}</td>
                <td className="px-4 py-3 text-mute">{b.company_size ?? "—"}</td>
                <td className="px-4 py-3 text-mute">{b.target_learners ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-mute">
                  {b.preferred_date
                    ? `${b.preferred_date}${b.preferred_time ? ` ${b.preferred_time}` : ""}`
                    : "—"}
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3 font-mono text-xs text-mute">
                  {new Date(b.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-mute">
                  No demo bookings yet. Requests appear here once someone submits the form at /book-a-demo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">
      {children}
    </th>
  );
}
