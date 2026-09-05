import { getDatabase } from "@/db";
import { firmsDetections } from "@/db/schema";

import type { FirmsDetection, FirmsRepository } from "./types";

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
};
