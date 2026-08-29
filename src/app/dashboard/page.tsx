import Link from "next/link";

import { requireUser } from "@/auth/authorization";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold tracking-[0.2em] text-orange-700 uppercase">
        Wildfire Tracker
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">Welcome</h1>
      <p className="mt-4 text-lg text-slate-600">Signed in as {user.email}</p>
      <div className="mt-8 flex items-center space-x-4">
        <Link
          className="rounded-md bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800"
          href="/locations"
        >
          Manage Locations
        </Link>
        <SignOutButton />
      </div>
    </main>
  );
}
