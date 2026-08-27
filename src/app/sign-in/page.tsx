import { AuthForm } from "@/components/auth/auth-form";

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-slate-600">
        Access your Wildfire Tracker account.
      </p>
      <AuthForm mode="sign-in" />
    </main>
  );
}
