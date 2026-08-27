import { AuthForm } from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-slate-600">Start using Wildfire Tracker.</p>
      <AuthForm mode="sign-up" />
    </main>
  );
}
