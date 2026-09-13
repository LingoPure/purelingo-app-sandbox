import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { adminSupabase } from "@/lib/employer/data";
import { ScreenStart } from "./screen-start";

export const dynamic = "force-dynamic";

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export default async function ScreenLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = adminSupabase();
  const { data } = await supabase
    .from("candidate_invites")
    .select("candidate_name, candidate_email, status, expires_at, employer_id, role_id")
    .eq("token", token)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const expired = isExpired(data.expires_at);
  if (expired) {
    redirect("/screen/expired");
  }

  const employer = await supabase
    .from("employers")
    .select("name")
    .eq("id", data.employer_id)
    .maybeSingle();
  const company = (employer.data as { name?: string } | null)?.name ?? null;

  const role = data.role_id
    ? await supabase.from("roles").select("name").eq("id", data.role_id).maybeSingle()
    : null;
  const roleName = (role?.data as { name?: string } | null)?.name ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb] px-4 py-12">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#ede8dc] bg-white shadow-sm">
        <div className="border-b border-[#ede8dc] px-8 py-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#c8973a]">
            LingoPure
          </p>
          <h1 className="mt-2 font-serif text-2xl text-[#0a2540]">
            Your English screen{company ? ` for ${company}` : ""}
          </h1>
        </div>
        <div className="px-8 py-7">
          {data.status === "completed" ? (
            <div className="text-center">
              <p className="text-sm text-[#6e777d]">
                You&apos;ve already completed this screen. Thank you!
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-[#0d1117]">
                Hi{data.candidate_name ? ` ${data.candidate_name}` : ""}, you&apos;ve been
                invited to take a short English assessment{roleName ? ` for the{" "}
                <span className="font-semibold">{roleName}</span> role` : ""}.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#6e777d]">
                <li>· Roughly 30 minutes, nothing to prepare</li>
                <li>· A conversational AI session + a short listening and speaking task</li>
                <li>· You&apos;ll get your own results profile afterwards</li>
              </ul>
              <div className="mt-6">
                <ScreenStart token={token} />
              </div>
              <p className="mt-4 text-xs text-[#8fa3b1]">
                We&apos;ll send a secure sign-in link to your email. The link is personal and
                works for a limited time.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}