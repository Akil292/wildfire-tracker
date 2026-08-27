import { NextResponse } from "next/server";

import { clearAttempts, isRateLimited, recordAttempt } from "@/auth/rate-limit";
import {
  getEmailFromRequestBody,
  hasValidOrigin,
  rateLimitKey,
  setSessionCookie,
} from "@/auth/request";
import { drizzleAuthRepository } from "@/auth/repository";
import { signUp } from "@/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => undefined);
  const key = rateLimitKey(request, getEmailFromRequestBody(body));
  if (isRateLimited(key)) {
    return NextResponse.json(
      { message: "Please try again later." },
      { status: 429 },
    );
  }

  recordAttempt(key);
  const result = await signUp(body, drizzleAuthRepository);
  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  clearAttempts(key);
  const response = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(response, result.token, result.expiresAt);
  return response;
}
