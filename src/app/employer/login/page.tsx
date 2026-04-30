import { LoginForm } from "./login-form";

export default async function EmployerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-paper/10 bg-navy-deep p-8">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.25em] text-gold">
          Employer access
        </p>
        <h1 className="mb-2 font-serif text-3xl text-paper">
          LingoPure pilot dashboard
        </h1>
        <p className="mb-6 text-sm text-mute">
          Single shared access for the pilot. Production will move to per-admin
          accounts.
        </p>
        <LoginForm redirectTo={redirectTo ?? "/employer"} />
      </div>
    </div>
  );
}
