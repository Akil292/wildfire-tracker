export type FirmsSource = "VIIRS_NOAA20_NRT" | "VIIRS_NOAA21_NRT";

export type FirmsSatellite = "N20" | "N21";

export const SUPPORTED_FIRMS_SOURCES: readonly FirmsSource[] = [
  "VIIRS_NOAA20_NRT",
  "VIIRS_NOAA21_NRT",
] as const;

export type BoundingBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type FirmsDetection = {
  id: string;
  source: FirmsSource;
  latitude: number;
  longitude: number;
  acqDate: string; // YYYY-MM-DD
  acqTime: string; // HHMM
  acqTimestamp: Date; // UTC DateTime
  satellite: FirmsSatellite;
  instrument: string; // VIIRS
  confidence: string; // nominal, low, high, n, l, h
  frp: number | null; // Fire Radiative Power (MW)
  brightTi4: number | null; // Kelvin
  brightTi5: number | null; // Kelvin
  scan: number | null; // Along-scan pixel size (km)
  track: number | null; // Along-track pixel size (km)
  daynight: string | null; // 'D' | 'N'
  version: string | null; // e.g. 2.0NRT
  ingestedAt?: Date;
};

export type FirmsIngestionSummary = {
  locationsProcessed: number;
  uniqueAreasQueried: number;
  requestsAttempted: number;
  requestsSucceeded: number;
  observationsReceived: number;
  newRowsInserted: number;
  duplicatesSkipped: number;
};

export interface FirmsRepository {
  insertDetections(
    detections: FirmsDetection[],
  ): Promise<{ insertedCount: number; duplicateCount: number }>;
}

export interface FirmsApiClient {
  fetchDetectionsCsv(
    source: FirmsSource,
    bbox: BoundingBox,
    dayRange?: number,
  ): Promise<string>;
}
