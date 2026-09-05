import { describe, expect, it, vi } from "vitest";

import { ingestFirmsData } from "@/firms/service";
import type {
  FirmsApiClient,
  FirmsDetection,
  FirmsRepository,
  FirmsSource,
} from "@/firms/types";

// Mock the DB query for enabled locations
vi.mock("@/db", () => {
  return {
    getDatabase: () => ({
      select: () => ({
        from: () => ({
          where: async () => [
            {
              id: "loc-1",
              latitude: 38.8951,
              longitude: -77.0364,
              monitorRadiusMiles: 25.0,
            },
          ],
        }),
      }),
    }),
  };
});

describe("firms-service", () => {
  const sampleCsv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
38.8951,-77.0364,320.0,0.4,0.4,2026-09-04,0930,20,VIIRS,nominal,2.0NRT,280.0,10.0,N`;

  it("orchestrates ingestion across supported sensors and calls repository", async () => {
    const mockApiClient: FirmsApiClient = {
      async fetchDetectionsCsv(source: FirmsSource): Promise<string> {
        if (source === "VIIRS_NOAA20_NRT") {
          return sampleCsv;
        }
        return `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
38.9000,-77.0400,315.0,0.4,0.4,2026-09-04,1845,21,VIIRS,high,2.0NRT,280.0,8.0,D`;
      },
    };

    const insertedDetections: FirmsDetection[] = [];
    const mockRepository: FirmsRepository = {
      async insertDetections(detections) {
        insertedDetections.push(...detections);
        return {
          insertedCount: detections.length,
          duplicateCount: 0,
        };
      },
    };

    const summary = await ingestFirmsData({
      apiClient: mockApiClient,
      repository: mockRepository,
    });

    expect(summary.locationsProcessed).toBe(1);
    expect(summary.uniqueAreasQueried).toBe(1);
    expect(summary.requestsAttempted).toBe(2); // NOAA-20 and NOAA-21
    expect(summary.requestsSucceeded).toBe(2);
    expect(summary.observationsReceived).toBe(2);
    expect(summary.newRowsInserted).toBe(2);
    expect(summary.duplicatesSkipped).toBe(0);

    expect(insertedDetections).toHaveLength(2);
    expect(insertedDetections[0].satellite).toBe("N20");
    expect(insertedDetections[1].satellite).toBe("N21");
  });

  it("handles API error on one sensor gracefully without failing the entire run", async () => {
    const mockApiClient: FirmsApiClient = {
      async fetchDetectionsCsv(source: FirmsSource): Promise<string> {
        if (source === "VIIRS_NOAA20_NRT") {
          return sampleCsv;
        }
        throw new Error("NASA FIRMS network glitch");
      },
    };

    const mockRepository: FirmsRepository = {
      async insertDetections(detections) {
        return {
          insertedCount: detections.length,
          duplicateCount: 0,
        };
      },
    };

    const summary = await ingestFirmsData({
      apiClient: mockApiClient,
      repository: mockRepository,
    });

    expect(summary.requestsAttempted).toBe(2);
    expect(summary.requestsSucceeded).toBe(1);
    expect(summary.observationsReceived).toBe(1);
    expect(summary.newRowsInserted).toBe(1);
  });
});
