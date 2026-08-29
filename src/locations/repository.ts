import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { savedLocations } from "@/db/schema";

import type { LocationRepository, SavedLocation } from "./types";

export const drizzleLocationRepository: LocationRepository = {
  async create(location: SavedLocation): Promise<SavedLocation> {
    const [inserted] = await getDatabase()
      .insert(savedLocations)
      .values({
        id: location.id,
        userId: location.userId,
        label: location.label,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        monitorRadiusMiles: location.monitorRadiusMiles,
        enabled: location.enabled,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
      })
      .returning();

    if (!inserted) {
      throw new Error("Location creation did not return a record.");
    }

    return {
      id: inserted.id,
      userId: inserted.userId,
      label: inserted.label,
      address: inserted.address,
      latitude: inserted.latitude,
      longitude: inserted.longitude,
      monitorRadiusMiles: inserted.monitorRadiusMiles,
      enabled: inserted.enabled,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  },

  async findByUser(userId: string): Promise<SavedLocation[]> {
    const records = await getDatabase()
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userId, userId))
      .orderBy(desc(savedLocations.createdAt));

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      label: r.label,
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      monitorRadiusMiles: r.monitorRadiusMiles,
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async findByIdAndUser(
    id: string,
    userId: string,
  ): Promise<SavedLocation | undefined> {
    const [record] = await getDatabase()
      .select()
      .from(savedLocations)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .limit(1);

    if (!record) {
      return undefined;
    }

    return {
      id: record.id,
      userId: record.userId,
      label: record.label,
      address: record.address,
      latitude: record.latitude,
      longitude: record.longitude,
      monitorRadiusMiles: record.monitorRadiusMiles,
      enabled: record.enabled,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  },

  async update(
    id: string,
    userId: string,
    data: Partial<
      Pick<
        SavedLocation,
        "label" | "monitorRadiusMiles" | "enabled" | "updatedAt"
      >
    >,
  ): Promise<SavedLocation | undefined> {
    const [updated] = await getDatabase()
      .update(savedLocations)
      .set(data)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .returning();

    if (!updated) {
      return undefined;
    }

    return {
      id: updated.id,
      userId: updated.userId,
      label: updated.label,
      address: updated.address,
      latitude: updated.latitude,
      longitude: updated.longitude,
      monitorRadiusMiles: updated.monitorRadiusMiles,
      enabled: updated.enabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await getDatabase()
      .delete(savedLocations)
      .where(and(eq(savedLocations.id, id), eq(savedLocations.userId, userId)))
      .returning({ id: savedLocations.id });

    return result.length > 0;
  },
};
