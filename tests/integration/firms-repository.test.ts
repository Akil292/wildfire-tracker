import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { closeDatabaseConnection, getDatabase } from "@/db";
import { firmsDetections } from "@/db/schema";
import { drizzleFirmsRepository } from "@/firms/repository";
import type { FirmsDetection } from "@/firms/types";

describe("firms-repository (PostgreSQL + PostGIS Integration)", () => {
  const testIds: string[] = [];

  afterAll(async () => {
    try {
      if (testIds.length > 0) {
        await getDatabase()
          .delete(firmsDetections)
          .where(inArray(firmsDetections.id, testIds));
      }
    } finally {
      await closeDatabaseConnection();
    }
  });

  it("inserts FIRMS detections and automatically populates PostGIS geography point", async () => {
    const id = `test-firms-${randomUUID()}`;
    testIds.push(id);

    const detection: FirmsDetection = {
      id,
      source: "VIIRS_NOAA20_NRT",
      latitude: 38.8451,
      longitude: -76.9284,
      acqDate: "2026-09-04",
      acqTime: "0930",
      acqTimestamp: new Date("2026-09-04T09:30:00.000Z"),
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "nominal",
      frp: 15.5,
      brightTi4: 325.0,
      brightTi5: 285.0,
      scan: 0.45,
      track: 0.39,
      daynight: "N",
      version: "2.0NRT",
    };

    const result = await drizzleFirmsRepository.insertDetections([detection]);
    expect(result.insertedCount).toBe(1);
    expect(result.duplicateCount).toBe(0);

    // Verify row and generated PostGIS point in database
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(firmsDetections)
      .where(eq(firmsDetections.id, id));

    expect(row).toBeDefined();
    expect(row.source).toBe("VIIRS_NOAA20_NRT");
    expect(row.satellite).toBe("N20");
    expect(row.latitude).toBeCloseTo(38.8451, 4);
    expect(row.longitude).toBeCloseTo(-76.9284, 4);
    expect(row.acqTimestamp.toISOString()).toBe("2026-09-04T09:30:00.000Z");

    // Query spatial representation using ST_AsText
    const [spatialCheck] = await db.execute<{ location_wkt: string }>(
      `SELECT ST_AsText(location) AS location_wkt FROM firms_detections WHERE id = '${id}';`,
    );
    expect(spatialCheck?.location_wkt).toMatch(
      /^POINT\(-76\.928\d+\s+38\.845\d+\)$/,
    );
  });

  it("enforces database deduplication on identical observations", async () => {
    const id1 = `test-firms-dedup-1-${randomUUID()}`;
    const id2 = `test-firms-dedup-2-${randomUUID()}`;
    testIds.push(id1, id2);

    const detection1: FirmsDetection = {
      id: id1,
      source: "VIIRS_NOAA20_NRT",
      latitude: 35.1234,
      longitude: -120.5678,
      acqDate: "2026-09-04",
      acqTime: "1200",
      acqTimestamp: new Date("2026-09-04T12:00:00.000Z"),
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "high",
      frp: 20.0,
      brightTi4: 330.0,
      brightTi5: 290.0,
      scan: 0.4,
      track: 0.4,
      daynight: "D",
      version: "2.0NRT",
    };

    // First insert
    const res1 = await drizzleFirmsRepository.insertDetections([detection1]);
    expect(res1.insertedCount).toBe(1);
    expect(res1.duplicateCount).toBe(0);

    // Second insert with identical identity (source, satellite, lat, lon, acq_date, acq_time) but different id
    const detection2: FirmsDetection = {
      ...detection1,
      id: id2,
      frp: 99.9, // Changed attribute should still be deduplicated based on identity
    };

    const res2 = await drizzleFirmsRepository.insertDetections([detection2]);
    expect(res2.insertedCount).toBe(0);
    expect(res2.duplicateCount).toBe(1);

    // Verify only 1 record exists in the database
    const db = getDatabase();
    const rows = await db
      .select()
      .from(firmsDetections)
      .where(eq(firmsDetections.acqDate, "2026-09-04"));

    const matching = rows.filter(
      (r) =>
        r.source === "VIIRS_NOAA20_NRT" &&
        Math.abs(r.latitude - 35.1234) < 0.0001 &&
        Math.abs(r.longitude - -120.5678) < 0.0001 &&
        r.acqTime === "1200",
    );
    expect(matching).toHaveLength(1);
    expect(matching[0].id).toBe(id1);
  });

  it("allows NOAA-20 and NOAA-21 detections to coexist at the same coordinates and timestamp", async () => {
    const idN20 = `test-firms-n20-${randomUUID()}`;
    const idN21 = `test-firms-n21-${randomUUID()}`;
    testIds.push(idN20, idN21);

    const base = {
      latitude: 40.5,
      longitude: -105.5,
      acqDate: "2026-09-04",
      acqTime: "1430",
      acqTimestamp: new Date("2026-09-04T14:30:00.000Z"),
      instrument: "VIIRS",
      confidence: "nominal",
      frp: 10.0,
      brightTi4: 310.0,
      brightTi5: 280.0,
      scan: 0.5,
      track: 0.5,
      daynight: "D",
      version: "2.0NRT",
    };

    const n20Detection: FirmsDetection = {
      ...base,
      id: idN20,
      source: "VIIRS_NOAA20_NRT",
      satellite: "N20",
    };

    const n21Detection: FirmsDetection = {
      ...base,
      id: idN21,
      source: "VIIRS_NOAA21_NRT",
      satellite: "N21",
    };

    const res = await drizzleFirmsRepository.insertDetections([
      n20Detection,
      n21Detection,
    ]);
    expect(res.insertedCount).toBe(2);
    expect(res.duplicateCount).toBe(0);
  });

  it("supports PostGIS spatial distance queries with GIST index", async () => {
    const id = `test-firms-spatial-${randomUUID()}`;
    testIds.push(id);

    const detection: FirmsDetection = {
      id,
      source: "VIIRS_NOAA20_NRT",
      latitude: 37.7749, // San Francisco
      longitude: -122.4194,
      acqDate: "2026-09-04",
      acqTime: "0800",
      acqTimestamp: new Date("2026-09-04T08:00:00.000Z"),
      satellite: "N20",
      instrument: "VIIRS",
      confidence: "high",
      frp: 30.0,
      brightTi4: 335.0,
      brightTi5: 295.0,
      scan: 0.4,
      track: 0.4,
      daynight: "N",
      version: "2.0NRT",
    };

    await drizzleFirmsRepository.insertDetections([detection]);

    const db = getDatabase();
    // Query within 10km (~10,000 meters) of SF coordinates
    const nearby = await db.execute<{ id: string }>(
      `SELECT id FROM firms_detections
       WHERE ST_DWithin(
         location,
         ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
         10000
       )
       AND id = '${id}';`,
    );

    expect(nearby).toHaveLength(1);
    expect(nearby[0].id).toBe(id);
  });
});
