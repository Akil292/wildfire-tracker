import { NextResponse } from "next/server";

import { getCurrentUser } from "@/auth/cookies";
import { hasValidOrigin } from "@/auth/request";
import {
  deleteSavedLocation,
  getSavedLocation,
  updateSavedLocation,
} from "@/locations/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const location = await getSavedLocation(id, user.id);

  if (!location) {
    return NextResponse.json(
      { message: "Location not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ location });
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

  const { id } = await params;
  const body: unknown = await request.json().catch(() => undefined);
  const result = await updateSavedLocation(id, user.id, body);

  if (!result.ok) {
    const status = result.message === "Location not found." ? 404 : 400;
    return NextResponse.json(
      { message: result.message, fieldErrors: result.fieldErrors },
      { status },
    );
  }

  return NextResponse.json({ ok: true, location: result.data });
}

export async function DELETE(request: Request, { params }: RouteContext) {
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

  const { id } = await params;
  const deleted = await deleteSavedLocation(id, user.id);

  if (!deleted) {
    return NextResponse.json(
      { message: "Location not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
