import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  getEmailFromRequestBody,
  hasValidOrigin,
  rateLimitKey,
  setSessionCookie,
} from "@/auth/request";
import { SESSION_COOKIE_NAME } from "@/auth/constants";

describe("authentication request helpers", () => {
  it("accepts same-origin requests and rejects cross-origin requests", () => {
    const sameOrigin = new Request("https://tracker.example/api/auth/sign-in", {
      headers: { origin: "https://tracker.example" },
    });
    const crossOrigin = new Request(
      "https://tracker.example/api/auth/sign-in",
      {
        headers: { origin: "https://attacker.example" },
      },
    );

    expect(hasValidOrigin(sameOrigin)).toBe(true);
    expect(hasValidOrigin(crossOrigin)).toBe(false);
  });

  it("normalizes rate-limit keys and safely reads email fields", () => {
    const request = new Request("https://tracker.example/api/auth/sign-in", {
      headers: { "x-forwarded-for": " 192.0.2.1, 192.0.2.2 " },
    });

    expect(rateLimitKey(request, " PERSON@Example.COM ")).toBe(
      "192.0.2.1:person@example.com",
    );
    expect(getEmailFromRequestBody({ email: "person@example.com" })).toBe(
      "person@example.com",
    );
    expect(getEmailFromRequestBody(null)).toBeUndefined();
  });

  it("sets and clears an HTTP-only session cookie", () => {
    const response = NextResponse.json({ ok: true });
    setSessionCookie(
      response,
      "session-token",
      new Date("2030-01-01T00:00:00.000Z"),
    );

    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("session-token");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");

    clearSessionCookie(response);
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.maxAge).toBe(0);
  });
});
