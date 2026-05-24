import { createClient } from "@/lib/supabase/server";
import { updateProfile, signOutEverywhere } from "./actions";
import { PasswordSection } from "./password-section";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { updated, error } = await searchParams;

  let name = "";
  let email = "";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? "";
    if (user) {
      const { data } = await supabase
        .from("students")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      name = (data as { name?: string } | null)?.name ?? "";
    }
  }

  const savedLabel =
    updated === "profile" ? "Profile saved." : updated === "password" ? "Password changed." : null;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.25em] text-gold">Settings</p>
        <h1 className="font-serif text-3xl text-navy">Your account</h1>
        <p className="mt-2 text-mute">
          Update your profile and change your password. These are your personal account
          settings — separate from your learning data and progress.
        </p>
      </div>

      {savedLabel && (
        <div className="rounded-md border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal">
          {savedLabel}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </div>
      )}

      {/* Profile */}
      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">Profile</h2>
        <form action={updateProfile} className="flex flex-col gap-4">
          <label className="flex max-w-sm flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Name</span>
            <input
              name="name"
              defaultValue={name}
              required
              className="rounded-md border border-cream bg-paper px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
          </label>
          <label className="flex max-w-sm flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              value={email}
              disabled
              className="rounded-md border border-cream bg-mist px-3 py-2.5 text-sm text-mute"
            />
            <span className="text-xs text-mute">
              To change your email, contact your coordinator or support.
            </span>
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
          >
            Save profile
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">Password</h2>
        <PasswordSection />
      </section>

      {/* Account */}
      <section className="rounded-lg border border-cream bg-paper p-6">
        <h2 className="mb-4 font-serif text-xl text-navy">Account</h2>
        <p className="mb-4 text-sm text-mute">
          Sign out of LingoPure on every device. Use this if you signed in on a shared
          or lost device — it ends all your active sessions, including this one.
        </p>
        <form action={signOutEverywhere}>
          <button
            type="submit"
            className="rounded-md border border-navy/30 px-4 py-2.5 text-sm font-medium text-navy hover:bg-mist"
          >
            Sign out everywhere
          </button>
        </form>
      </section>
    </div>
  );
}
