import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { closeDatabaseConnection, getDatabase } from "@/db";
import { users } from "@/db/schema";
import { drizzleLocationRepository } from "@/locations/repository";
import type { SavedLocation } from "@/locations/types";

describe("location-repository (PostgreSQL + PostGIS Integration)", () => {
  const userAId = `test-user-a-${randomUUID()}`;
  const userBId = `test-user-b-${randomUUID()}`;

  beforeAll(async () => {
    // Create two test users
    await getDatabase()
      .insert(users)
      .values([
        {
          id: userAId,
          email: `${userAId}@example.com`,
          passwordHash: "hash-a",
        },
        {
          id: userBId,
          email: `${userBId}@example.com`,
          passwordHash: "hash-b",
        },
      ]);
  });

  afterAll(async () => {
    try {
      // Cascades will clean up saved_locations automatically
      await getDatabase().delete(users).where(eq(users.id, userAId));
      await getDatabase().delete(users).where(eq(users.id, userBId));
    } finally {
      await closeDatabaseConnection();
    }
  });

  it("persists a saved location with automatic PostGIS point computation", async () => {
    const locId = `loc-${randomUUID()}`;
    const now = new Date();
    const newLocation: SavedLocation = {
      id: locId,
      userId: userAId,
      label: "User A Home",
      address: "4600 Silver Hill Rd, Washington, DC 20233",
      latitude: 38.845053,
      longitude: -76.928366,
      monitorRadiusMiles: 25.0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await drizzleLocationRepository.create(newLocation);
    expect(saved.id).toBe(locId);
    expect(saved.label).toBe("User A Home");
    expect(saved.latitude).toBeCloseTo(38.845053, 4);
    expect(saved.longitude).toBeCloseTo(-76.928366, 4);

    // Verify retrieval by user
    const userAList = await drizzleLocationRepository.findByUser(userAId);
    expect(userAList.some((l) => l.id === locId)).toBe(true);

    // Verify isolation: User B cannot see User A's location
    const userBList = await drizzleLocationRepository.findByUser(userBId);
    expect(userBList.some((l) => l.id === locId)).toBe(false);

    const userBGet = await drizzleLocationRepository.findByIdAndUser(
      locId,
      userBId,
    );
    expect(userBGet).toBeUndefined();

    // Verify User A can retrieve it
    const userAGet = await drizzleLocationRepository.findByIdAndUser(
      locId,
      userAId,
    );
    expect(userAGet).toBeDefined();
    expect(userAGet?.label).toBe("User A Home");

    // Verify update with ownership check
    const updated = await drizzleLocationRepository.update(locId, userAId, {
      label: "Updated Home",
      enabled: false,
    });
    expect(updated?.label).toBe("Updated Home");
    expect(updated?.enabled).toBe(false);

    // User B cannot update User A's location
    const unauthorizedUpdate = await drizzleLocationRepository.update(
      locId,
      userBId,
      { label: "Hacked" },
    );
    expect(unauthorizedUpdate).toBeUndefined();

    // User B cannot delete User A's location
    const unauthorizedDelete = await drizzleLocationRepository.delete(
      locId,
      userBId,
    );
    expect(unauthorizedDelete).toBe(false);

    // User A deletes location
    const deleted = await drizzleLocationRepository.delete(locId, userAId);
    expect(deleted).toBe(true);

    const afterDelete = await drizzleLocationRepository.findByIdAndUser(
      locId,
      userAId,
    );
    expect(afterDelete).toBeUndefined();
  });
});
