import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "./constants";
import { sessionCookieOptions } from "./cookies";

export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);

    if (originUrl.origin === requestUrl.origin) {
      return true;
    }

    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host && originUrl.host === host) {
      return true;
    }

    // Treat localhost and 127.0.0.1 as equivalent for local dev and test environments
    const normalizedOriginHost = originUrl.host.replace(
      "127.0.0.1",
      "localhost",
    );
    const normalizedRequestHost = requestUrl.host.replace(
      "127.0.0.1",
      "localhost",
    );
    return normalizedOriginHost === normalizedRequestHost;
  } catch {
    return false;
  }
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
