import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "./constants";
import { sessionCookieOptions } from "./cookies";

export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}

export function rateLimitKey(request: Request, email: unknown): string {
  const forwardedFor =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const address =
    typeof email === "string" ? email.trim().toLowerCase() : "unknown";
  return `${forwardedFor}:${address}`;
}

export function getEmailFromRequestBody(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("email" in body)) {
    return undefined;
  }
  return body.email;
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieOptions,
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
}
