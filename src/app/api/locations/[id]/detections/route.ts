import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/auth/cookies";
import { getNearbyDetectionsForLocation } from "@/firms/service";

const querySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { message: "Location ID is required." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawHours = searchParams.get("hours");
  const parsedQuery = querySchema.safeParse({
    hours: rawHours ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        message:
          "Invalid hours parameter. Must be an integer between 1 and 168.",
      },
      { status: 400 },
    );
  }

  const { hours } = parsedQuery.data;

  const result = await getNearbyDetectionsForLocation(id, user.id, { hours });
  if (!result) {
    return NextResponse.json(
      { message: "Location not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(result, { status: 200 });
}
