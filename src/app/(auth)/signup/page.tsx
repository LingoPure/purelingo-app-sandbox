import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div>
      <h1 className="mb-1 font-serif text-3xl text-navy">Create your account</h1>
      <p className="mb-6 text-sm text-mute">
        Start with a 20-minute AI discovery session — no manual placement test.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal">
          {message}
        </div>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <Field label="Full name" name="fullName" type="text" required />
        <Field label="Work email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required minLength={8} />
        <button
          type="submit"
          className="mt-2 rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-paper hover:bg-navy-deep"
        >
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-mute">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  minLength,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        className="rounded-md border border-cream bg-paper px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
      />
    </label>
  );
}
