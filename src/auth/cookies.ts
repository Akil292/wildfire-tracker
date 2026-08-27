import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "./constants";
import { drizzleAuthRepository } from "./repository";
import { getSessionUser } from "./service";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getSessionUser(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    drizzleAuthRepository,
  );
}
