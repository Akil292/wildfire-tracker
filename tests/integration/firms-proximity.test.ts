import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabaseConnection, getDatabase } from "@/db";
import { firmsDetections, users } from "@/db/schema";
import { drizzleFirmsRepository } from "@/firms/repository";
import type { FirmsDetection } from "@/firms/types";
import { drizzleLocationRepository } from "@/locations/repository";

describe("PostGIS Proximity Query Integration", () => {
  const userAId = `test-user-a-${randomUUID()}`;
  const userBId = `test-user-b-${randomUUID()}`;
  const locationAId = `test-loc-a-${randomUUID()}`;
  const locationBId = `test-loc-b-${randomUUID()}`;

  const createdDetectionIds: string[] = [];

  beforeAll(async () => {
    const db = getDatabase();

    // 1. Create Users
    await db.insert(users).values([
      {
        id: userAId,
        email: `usera-${randomUUID()}@example.com`,
        passwordHash: "hash_placeholder",
      },
      {
        id: userBId,
        email: `userb-${randomUUID()}@example.com`,
        passwordHash: "hash_placeholder",
      },
    ]);

    // 2. Create Saved Locations
    // Location A: Washington DC, 25 mi radius
    await drizzleLocationRepository.create({
      id: locationAId,
      userId: userAId,
      label: "DC Home",
      address: "1600 Pennsylvania Avenue NW, Washington, DC",
      latitude: 38.8977,
      longitude: -77.0365,
      monitorRadiusMiles: 25.0,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Location B: San Francisco, 20 mi radius
    await drizzleLocationRepository.create({
      id: locationBId,
      userId: userBId,
      label: "SF Office",
      address: "100 California St, San Francisco, CA",
      latitude: 37.7937,
      longitude: -122.3988,
      monitorRadiusMiles: 20.0,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Create FIRMS detections
    const now = Date.now();
    const recentTime1 = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
    const recentTime2 = new Date(now - 6 * 60 * 60 * 1000); // 6 hours ago
    const oldTime = new Date(now - 48 * 60 * 60 * 1000); // 48 hours ago

    const detNear1: FirmsDetection = {
      id: `test-det-near1-${randomUUID()}`,
      source: "VIIRS_NOAA20_NRT",
      latitude: 38.8451, // ~4.5 miles from DC location
      longitude: -76.9284,
      acqDate: recentTime1.toISOString().slice(0, 10),
      acqTime: "1200",
      acqTimestamp: recentTime1,
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "high",
      frp: 22.0,
      brightTi4: 330.0,
      brightTi5: 290.0,
      scan: 0.4,
      track: 0.4,
      daynight: "D",
      version: "2.0NRT",
    };

    const detNear2: FirmsDetection = {
      id: `test-det-near2-${randomUUID()}`,
      source: "VIIRS_NOAA21_NRT",
      latitude: 39.05, // ~12 miles from DC location
      longitude: -77.15,
      acqDate: recentTime2.toISOString().slice(0, 10),
      acqTime: "0800",
      acqTimestamp: recentTime2,
      satellite: "N21",
      instrument: "VIIRS",
      confidence: "nominal",
      frp: 14.0,
      brightTi4: 320.0,
      brightTi5: 280.0,
      scan: 0.45,
      track: 0.39,
      daynight: "N",
      version: "2.0NRT",
    };

    const detFar: FirmsDetection = {
      id: `test-det-far-${randomUUID()}`,
      source: "VIIRS_NOAA20_NRT",
      latitude: 37.54, // Richmond VA (~95 miles from DC location)
      longitude: -77.43,
      acqDate: recentTime1.toISOString().slice(0, 10),
      acqTime: "1200",
      acqTimestamp: recentTime1,
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "nominal",
      frp: 10.0,
      brightTi4: 315.0,
      brightTi5: 275.0,
      scan: 0.5,
      track: 0.5,
      daynight: "D",
      version: "2.0NRT",
    };

    const detOld: FirmsDetection = {
      id: `test-det-old-${randomUUID()}`,
      source: "VIIRS_NOAA20_NRT",
      latitude: 38.88, // ~3 miles from DC location, but 48 hours old
      longitude: -77.02,
      acqDate: oldTime.toISOString().slice(0, 10),
      acqTime: "0600",
      acqTimestamp: oldTime,
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "low",
      frp: 8.0,
      brightTi4: 310.0,
      brightTi5: 270.0,
      scan: 0.4,
      track: 0.4,
      daynight: "N",
      version: "2.0NRT",
    };

    createdDetectionIds.push(detNear1.id, detNear2.id, detFar.id, detOld.id);

    await drizzleFirmsRepository.insertDetections([
      detNear1,
      detNear2,
      detFar,
      detOld,
    ]);
  });

  afterAll(async () => {
    try {
      const db = getDatabase();
      if (createdDetectionIds.length > 0) {
        await db
          .delete(firmsDetections)
          .where(inArray(firmsDetections.id, createdDetectionIds));
      }
      await db.delete(users).where(inArray(users.id, [userAId, userBId]));
    } finally {
      await closeDatabaseConnection();
    }
  });

  it("returns only recent detections inside the monitoring radius and calculates distance accurately", async () => {
    const result = await drizzleFirmsRepository.findNearbyForLocation(
      locationAId,
      userAId,
      { hours: 24 },
    );

    expect(result).toBeDefined();
    expect(result!.location.id).toBe(locationAId);
    expect(result!.windowHours).toBe(24);

    // Should include detNear1 (NOAA-20) and detNear2 (NOAA-21), but NOT detFar (outside radius) or detOld (outside 24h)
    const returnedIds = result!.detections.map((d) => d.id);
    expect(returnedIds).toHaveLength(2);
    expect(returnedIds).toContain(createdDetectionIds[0]); // detNear1
    expect(returnedIds).toContain(createdDetectionIds[1]); // detNear2
    expect(returnedIds).not.toContain(createdDetectionIds[2]); // detFar
    expect(returnedIds).not.toContain(createdDetectionIds[3]); // detOld

    // Verify distance calculation
    const det1 = result!.detections.find(
      (d) => d.id === createdDetectionIds[0],
    );
    expect(det1).toBeDefined();
    expect(det1!.distanceMiles).toBeGreaterThan(4);
    expect(det1!.distanceMiles).toBeLessThan(8);

    const det2 = result!.detections.find(
      (d) => d.id === createdDetectionIds[1],
    );
    expect(det2).toBeDefined();
    expect(det2!.distanceMiles).toBeGreaterThan(10);
    expect(det2!.distanceMiles).toBeLessThan(16);

    // Verify ordering: newest first (detNear1 is 2h ago, detNear2 is 6h ago)
    expect(result!.detections[0].id).toBe(createdDetectionIds[0]);
    expect(result!.detections[1].id).toBe(createdDetectionIds[1]);
  });

  it("enforces server-side user ownership isolation (returns undefined for another user's location)", async () => {
    // User B tries to query User A's location
    const unownedResult = await drizzleFirmsRepository.findNearbyForLocation(
      locationAId,
      userBId,
      { hours: 24 },
    );

    expect(unownedResult).toBeUndefined();
  });

  it("returns an empty detection list when no detections exist in the radius", async () => {
    const sfResult = await drizzleFirmsRepository.findNearbyForLocation(
      locationBId,
      userBId,
      { hours: 24 },
    );

    expect(sfResult).toBeDefined();
    expect(sfResult!.location.id).toBe(locationBId);
    expect(sfResult!.detections).toHaveLength(0);
  });
});
