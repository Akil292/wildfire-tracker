import Link from "next/link";

import { requireUser } from "@/auth/authorization";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocationsManager } from "@/components/locations/locations-manager";
import { listSavedLocations } from "@/locations/service";

export default async function LocationsPage() {
  const user = await requireUser();
  const locations = await listSavedLocations(user.id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <Link
              className="font-medium text-orange-700 hover:underline"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <span>/</span>
            <span>Locations</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Monitored Locations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as <span className="font-medium">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <SignOutButton />
        </div>
      </div>

      <div className="mt-8">
        <LocationsManager initialLocations={locations} />
      </div>
    </main>
  );
}
