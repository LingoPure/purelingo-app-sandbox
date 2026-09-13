// @explanatory-header-exempt — portal surface; the page heading is the explanatory header
import Link from "next/link";
import { requireEmployerAdmin } from "@/lib/employer/auth";
import { adminSupabase } from "@/lib/employer/data";
import { loadRolesIndex } from "@/lib/employer/roles-data";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { InviteCandidateForm } from "./invite-form";

export const dynamic = "force-dynamic";

type CandidateInviteRow = {
  id: string;
  candidate_name: string | null;
  candidate_email: string;
  status: string;
  role_id: string | null;
  student_id: string | null;
  created_at: string;
  expires_at: string;
  roles: { name: string }[] | null;
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  invited: { label: "Invited", className: "bg-amber-100 text-amber-800" },
  started: { label: "In progress", className: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600" },
};

function statusStyles(status: string) {
  return STATUS_LABEL[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
}

export default async function CandidatesPage() {
  const auth = await requireEmployerAdmin();
  if (auth instanceof NextResponse) {
    redirect("/login?redirectTo=/employer/candidates");
  }
  const employerId = auth.admin.employerId;

  const [invitesRows, roles] = await Promise.all([
    adminSupabase()
      .from("candidate_invites")
      .select("id, candidate_name, candidate_email, status, role_id, student_id, created_at, expires_at, roles(name)")
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false }),
    loadRolesIndex(),
  ]);

  // "Completed" is derived at read time from the linked student having a
  // finished battery session — no write-path hook needed for the MVP.
  const invites = (invitesRows.data ?? []) as CandidateInviteRow[];
  const studentIds = invites.flatMap((i) => (i.student_id ? [i.student_id] : []));
  const { data: doneSessions } = studentIds.length
    ? await adminSupabase()
        .from("assessment_sessions")
        .select("student_id")
        .in("student_id", studentIds)
        .eq("status", "complete")
    : { data: [] };
  const doneStudentIds = new Set((doneSessions ?? []).map((r: { student_id: string }) => r.student_id));
  const displayStatus = (i: CandidateInviteRow): string =>
    i.status === "started" && i.student_id && doneStudentIds.has(i.student_id) ? "completed" : i.status;

  const sentCount = invites.length;
  const completedCount = invites.filter((i) => displayStatus(i) === "completed").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl text-navy">Candidate screening</h2>
        <p className="mt-1 text-sm text-mute">
          Invite a candidate to take the LingoPure English screen before you
          interview them. Each invite points at their full role-fit profile once
          they finish the 30-minute assessment.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Invites sent" value={String(sentCount)} />
        <Stat label="Completed" value={String(completedCount)} />
        <Stat label="Conversion" value={sentCount ? `${Math.round((completedCount / sentCount) * 100)}%` : "—"} />
      </div>

      <InviteCandidateForm roles={roles} />

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50">
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">Candidate</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">Target role</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">Status</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">Invited</th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-mute">Role-fit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invites.map((invite) => {
              const st = statusStyles(displayStatus(invite));
              return (
                <tr key={invite.id} className="hover:bg-mist/40">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-ink">
                      {invite.candidate_name ?? invite.candidate_email}
                    </div>
                    {invite.candidate_name && (
                      <div className="text-xs text-mute">{invite.candidate_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-mute">{invite.roles?.[0]?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${st.className}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mute">
                    {new Date(invite.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {invite.student_id ? (
                      <Link
                        href={`/employer/students/${invite.student_id}`}
                        className="font-semibold text-navy underline-offset-2 hover:underline"
                      >
                        View profile
                      </Link>
                    ) : (
                      <span className="text-mute">Awaiting assessment</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {invites.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-mute">
                  No candidates yet. Invite your first candidate on the left.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="font-serif text-3xl text-navy">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-mute">{label}</div>
    </div>
  );
}