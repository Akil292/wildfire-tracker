import { redirect } from "next/navigation";

import { getCurrentUser } from "./cookies";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}
