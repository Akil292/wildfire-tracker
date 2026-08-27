"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border border-slate-300 px-4 py-2 font-semibold"
      disabled={isPending}
      onClick={signOut}
      type="button"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
