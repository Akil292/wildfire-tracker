import { NextResponse } from "next/server";

import { getCurrentUser } from "@/auth/cookies";
import { hasValidOrigin } from "@/auth/request";
import { geocodeAddress } from "@/locations/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => undefined);
  const result = await geocodeAddress(body);

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, fieldErrors: result.fieldErrors },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, result: result.data });
}
