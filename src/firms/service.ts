import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { savedLocations } from "@/db/schema";

import { calculateBoundingBox, deduplicateBoundingBoxes } from "./bounding-box";
import { defaultFirmsClient } from "./client";
import { parseFirmsCsv } from "./parser";
import { drizzleFirmsRepository } from "./repository";
import {
  SUPPORTED_FIRMS_SOURCES,
  type FirmsApiClient,
  type FirmsDetection,
  type FirmsIngestionSummary,
  type FirmsRepository,
} from "./types";

export type IngestionServiceOptions = {
  apiClient?: FirmsApiClient;
  repository?: FirmsRepository;
  dayRange?: number;
};

/**
 * Loads all enabled saved locations, calculates their monitoring bounding boxes,
 * queries NASA FIRMS for NOAA-20 and NOAA-21 NRT detections, and idempotently
 * stores and deduplicates them in PostgreSQL.
 */
export async function ingestFirmsData(
  options: IngestionServiceOptions = {},
): Promise<FirmsIngestionSummary> {
  const apiClient = options.apiClient ?? defaultFirmsClient;
  const repository = options.repository ?? drizzleFirmsRepository;
  const dayRange = options.dayRange ?? 1;

  // 1. Fetch enabled saved locations
  const db = getDatabase();
  const enabledLocations = await db
    .select({
      id: savedLocations.id,
      latitude: savedLocations.latitude,
      longitude: savedLocations.longitude,
      monitorRadiusMiles: savedLocations.monitorRadiusMiles,
    })
    .from(savedLocations)
    .where(eq(savedLocations.enabled, true));

  if (enabledLocations.length === 0) {
    return {
      locationsProcessed: 0,
      uniqueAreasQueried: 0,
      requestsAttempted: 0,
      requestsSucceeded: 0,
      observationsReceived: 0,
      newRowsInserted: 0,
      duplicatesSkipped: 0,
    };
  }

  // 2. Compute and deduplicate bounding boxes
  const rawBoxes = enabledLocations.map((loc) =>
    calculateBoundingBox(loc.latitude, loc.longitude, loc.monitorRadiusMiles),
  );
  const uniqueBoxes = deduplicateBoundingBoxes(rawBoxes);

  let requestsAttempted = 0;
  let requestsSucceeded = 0;
  const allDetections: FirmsDetection[] = [];

  // 3. Query FIRMS Area API for each unique area and each supported VIIRS sensor
  for (const bbox of uniqueBoxes) {
    for (const source of SUPPORTED_FIRMS_SOURCES) {
      requestsAttempted++;
      try {
        const csvText = await apiClient.fetchDetectionsCsv(
          source,
          bbox,
          dayRange,
        );
        requestsSucceeded++;

        const parsedDetections = parseFirmsCsv(csvText, source);
        allDetections.push(...parsedDetections);
      } catch (error: unknown) {
        // Individual query failure should not crash the entire ingestion pipeline
        console.error(
          `[FIRMS Ingestion] Error querying ${source}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }
  }

  // 4. Batch insert and deduplicate at the database level
  const { insertedCount, duplicateCount } =
    await repository.insertDetections(allDetections);

  return {
    locationsProcessed: enabledLocations.length,
    uniqueAreasQueried: uniqueBoxes.length,
    requestsAttempted,
    requestsSucceeded,
    observationsReceived: allDetections.length,
    newRowsInserted: insertedCount,
    duplicatesSkipped: duplicateCount,
  };
}
