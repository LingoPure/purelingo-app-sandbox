import { redirect } from "next/navigation";

/**
 * /employer/login is retired — auth is now Supabase-based via /login.
 * Anyone hitting this URL gets bounced to the regular login form with
 * a redirectTo back into the employer dashboard.
 */
export default async function EmployerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const next = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/employer";
  redirect(`/login?redirectTo=${encodeURIComponent(next)}`);
}
