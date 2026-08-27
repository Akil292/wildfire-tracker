import { NextResponse } from "next/server";

import { GENERIC_CREDENTIALS_ERROR } from "@/auth/constants";
import { clearAttempts, isRateLimited, recordAttempt } from "@/auth/rate-limit";
import {
  getEmailFromRequestBody,
  hasValidOrigin,
  rateLimitKey,
  setSessionCookie,
} from "@/auth/request";
import { drizzleAuthRepository } from "@/auth/repository";
import { signIn } from "@/auth/service";

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
  const result = await signIn(body, drizzleAuthRepository);
  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.fieldErrors
          ? result.message
          : GENERIC_CREDENTIALS_ERROR,
        fieldErrors: result.fieldErrors,
      },
      { status: 401 },
    );
  }

  clearAttempts(key);
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, result.token, result.expiresAt);
  return response;
}
