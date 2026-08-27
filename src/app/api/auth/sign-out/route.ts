import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/auth/constants";
import { hasValidOrigin, clearSessionCookie } from "@/auth/request";
import { drizzleAuthRepository } from "@/auth/repository";
import { signOut } from "@/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  await signOut(
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
    drizzleAuthRepository,
  );

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
