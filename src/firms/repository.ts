import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { firmsDetections, savedLocations } from "@/db/schema";

import type {
  FindNearbyDetectionsOptions,
  FirmsDetection,
  FirmsRepository,
  FirmsSatellite,
  FirmsSource,
  LocationDetectionsResult,
  NearbyFirmsDetection,
} from "./types";

const BATCH_SIZE = 250;

export const drizzleFirmsRepository: FirmsRepository = {
  async insertDetections(
    detections: FirmsDetection[],
  ): Promise<{ insertedCount: number; duplicateCount: number }> {
    if (detections.length === 0) {
      return { insertedCount: 0, duplicateCount: 0 };
    }

    const db = getDatabase();
    let totalInserted = 0;

    // Process in batches to keep parameter counts within PostgreSQL limits
    for (let i = 0; i < detections.length; i += BATCH_SIZE) {
      const batch = detections.slice(i, i + BATCH_SIZE);

      const rowsToInsert = batch.map((d) => ({
        id: d.id,
        source: d.source,
        latitude: d.latitude,
        longitude: d.longitude,
        acqDate: d.acqDate,
        acqTime: d.acqTime,
        acqTimestamp: d.acqTimestamp,
        satellite: d.satellite,
        instrument: d.instrument,
        confidence: d.confidence,
        frp: d.frp,
        brightTi4: d.brightTi4,
        brightTi5: d.brightTi5,
        scan: d.scan,
        track: d.track,
        daynight: d.daynight,
        version: d.version,
        ingestedAt: d.ingestedAt ?? new Date(),
      }));

      const inserted = await db
        .insert(firmsDetections)
        .values(rowsToInsert)
        .onConflictDoNothing({
          target: [
            firmsDetections.source,
            firmsDetections.satellite,
            firmsDetections.latitude,
            firmsDetections.longitude,
            firmsDetections.acqDate,
            firmsDetections.acqTime,
          ],
        })
        .returning({ id: firmsDetections.id });

      totalInserted += inserted.length;
    }

    const duplicateCount = Math.max(0, detections.length - totalInserted);

    return {
      insertedCount: totalInserted,
      duplicateCount,
    };
  },

  async findNearbyForLocation(
    locationId: string,
    userId: string,
    options: FindNearbyDetectionsOptions = {},
  ): Promise<LocationDetectionsResult | undefined> {
    const db = getDatabase();
    const windowHours = Math.max(1, Math.min(168, options.hours ?? 24));
    const sinceTimestamp = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    // 1. Fetch the user's saved location to enforce ownership and get configuration
    const [loc] = await db
      .select()
      .from(savedLocations)
      .where(
        and(
          eq(savedLocations.id, locationId),
          eq(savedLocations.userId, userId),
        ),
      )
      .limit(1);

    if (!loc) {
      return undefined;
    }

    const radiusMeters = loc.monitorRadiusMiles * 1609.344;

    // 2. Query nearby detections using parameterized PostGIS ST_DWithin and ST_Distance
    const rawRows = await db.execute<{
      id: string;
      source: FirmsSource;
      latitude: number;
      longitude: number;
      acqTimestamp: string | Date;
      satellite: FirmsSatellite;
      confidence: string;
      frp: number | null;
      distanceMiles: number;
    }>(sql`
      SELECT
        f.id,
        f.source,
        f.latitude,
        f.longitude,
        f.acq_timestamp AS "acqTimestamp",
        f.satellite,
        f.confidence,
        f.frp,
        (ST_Distance(f.location, s.location) / 1609.344)::float8 AS "distanceMiles"
      FROM firms_detections f
      JOIN saved_locations s ON s.id = ${locationId} AND s.user_id = ${userId}
      WHERE ST_DWithin(f.location, s.location, ${radiusMeters})
        AND f.acq_timestamp >= ${sinceTimestamp.toISOString()}
      ORDER BY f.acq_timestamp DESC, "distanceMiles" ASC
    `);

    const detections: NearbyFirmsDetection[] = rawRows.map((r) => ({
      id: r.id,
      source: r.source,
      satellite: r.satellite,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      acqTimestamp:
        r.acqTimestamp instanceof Date
          ? r.acqTimestamp
          : new Date(r.acqTimestamp),
      confidence: r.confidence,
      frp: r.frp !== null ? Number(r.frp) : null,
      distanceMiles: Number(Number(r.distanceMiles).toFixed(2)),
    }));

    return {
      location: {
        id: loc.id,
        userId: loc.userId,
        label: loc.label,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        monitorRadiusMiles: loc.monitorRadiusMiles,
        enabled: loc.enabled,
        createdAt: loc.createdAt,
        updatedAt: loc.updatedAt,
      },
      detections,
      windowHours,
    };
  },
};
