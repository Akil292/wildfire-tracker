import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import * as auth from "@/auth/cookies";
import * as firmsService from "@/firms/service";
import { GET } from "@/app/api/locations/[id]/detections/route";

describe("GET /api/locations/[id]/detections", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.spyOn(auth, "getCurrentUser").mockResolvedValueOnce(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/locations/loc-1/detections",
    );
    const context = { params: Promise.resolve({ id: "loc-1" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 404 when saved location does not exist or is not owned by user", async () => {
    vi.spyOn(auth, "getCurrentUser").mockResolvedValueOnce({
      id: "user-1",
      email: "user1@example.com",
      createdAt: new Date(),
    });

    vi.spyOn(
      firmsService,
      "getNearbyDetectionsForLocation",
    ).mockResolvedValueOnce(undefined);

    const req = new NextRequest(
      "http://localhost:3000/api/locations/loc-unowned/detections",
    );
    const context = { params: Promise.resolve({ id: "loc-unowned" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe("Location not found.");
  });

  it("returns 200 with detections when location belongs to user", async () => {
    vi.spyOn(auth, "getCurrentUser").mockResolvedValueOnce({
      id: "user-1",
      email: "user1@example.com",
      createdAt: new Date(),
    });

    const mockResult = {
      location: {
        id: "loc-1",
        userId: "user-1",
        label: "Home",
        address: "123 Main St",
        latitude: 38.8951,
        longitude: -77.0364,
        monitorRadiusMiles: 25,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      windowHours: 24,
      detections: [
        {
          id: "det-1",
          source: "VIIRS_NOAA20_NRT" as const,
          satellite: "N20" as const,
          latitude: 38.8451,
          longitude: -76.9284,
          acqTimestamp: new Date("2026-09-04T09:30:00.000Z"),
          confidence: "nominal",
          frp: 12.4,
          distanceMiles: 3.82,
        },
      ],
      activityGroups: [
        {
          id: "group_mock1",
          detectionCount: 1,
          representativeLatitude: 38.8451,
          representativeLongitude: -76.9284,
          minDistanceMiles: 3.82,
          earliestAcqTimestamp: new Date("2026-09-04T09:30:00.000Z"),
          latestAcqTimestamp: new Date("2026-09-04T09:30:00.000Z"),
          sources: ["VIIRS_NOAA20_NRT" as const],
          satellites: ["N20" as const],
          maxFrp: 12.4,
          detections: [],
        },
      ],
    };

    vi.spyOn(
      firmsService,
      "getNearbyDetectionsForLocation",
    ).mockResolvedValueOnce(mockResult);

    const req = new NextRequest(
      "http://localhost:3000/api/locations/loc-1/detections?hours=24",
    );
    const context = { params: Promise.resolve({ id: "loc-1" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.location.id).toBe("loc-1");
    expect(body.detections).toHaveLength(1);
    expect(body.detections[0].distanceMiles).toBe(3.82);
    expect(body.detections[0].satellite).toBe("N20");
    expect(body.detections[0].brightTi4).toBeUndefined();
    expect(body.activityGroups).toHaveLength(1);
    expect(body.activityGroups[0].id).toBe("group_mock1");
  });

  it("returns 400 when hours parameter is invalid or outside 1-168 range", async () => {
    vi.spyOn(auth, "getCurrentUser").mockResolvedValue({
      id: "user-1",
      email: "user1@example.com",
      createdAt: new Date(),
    });

    const invalidInputs = ["0", "-5", "169", "abc", "2.5"];

    for (const invalid of invalidInputs) {
      const req = new NextRequest(
        `http://localhost:3000/api/locations/loc-1/detections?hours=${invalid}`,
      );
      const context = { params: Promise.resolve({ id: "loc-1" }) };

      const res = await GET(req, context);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Invalid hours parameter");
    }
  });
});
