import { randomUUID } from "node:crypto";

import type { FirmsDetection, FirmsSatellite, FirmsSource } from "./types";

export class FirmsParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirmsParsingError";
  }
}

/**
 * Normalizes satellite identifier from raw FIRMS CSV value to 'N20' or 'N21'.
 * Validates consistency with the requested FIRMS source.
 */
export function normalizeSatellite(
  rawSatellite: string,
  source: FirmsSource,
): FirmsSatellite {
  const cleaned = rawSatellite.trim().toUpperCase();

  if (source === "VIIRS_NOAA20_NRT") {
    if (
      cleaned === "20" ||
      cleaned === "N20" ||
      cleaned === "NOAA-20" ||
      cleaned === "NOAA20" ||
      cleaned === "JPSS-1"
    ) {
      return "N20";
    }
    throw new FirmsParsingError(
      `Unexpected satellite "${rawSatellite}" for source VIIRS_NOAA20_NRT. Expected NOAA-20 (N20).`,
    );
  }

  if (source === "VIIRS_NOAA21_NRT") {
    if (
      cleaned === "21" ||
      cleaned === "N21" ||
      cleaned === "NOAA-21" ||
      cleaned === "NOAA21" ||
      cleaned === "JPSS-2"
    ) {
      return "N21";
    }
    throw new FirmsParsingError(
      `Unexpected satellite "${rawSatellite}" for source VIIRS_NOAA21_NRT. Expected NOAA-21 (N21).`,
    );
  }

  throw new FirmsParsingError(`Unsupported FIRMS source: ${source}`);
}

/**
 * Normalizes acq_date (YYYY-MM-DD) and acq_time (HHMM / HMM) into a valid UTC Date object.
 */
export function parseAcquisitionTimestamp(
  acqDate: string,
  acqTime: string,
): { formattedTime: string; timestamp: Date } {
  const trimmedDate = acqDate.trim();
  const trimmedTime = acqTime.trim().padStart(4, "0");

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^([01]\d|2[0-3])[0-5]\d$/;

  if (!dateRegex.test(trimmedDate)) {
    throw new FirmsParsingError(
      `Invalid acquisition date format: "${acqDate}". Expected YYYY-MM-DD.`,
    );
  }

  if (!timeRegex.test(trimmedTime)) {
    throw new FirmsParsingError(
      `Invalid acquisition time format: "${acqTime}". Expected HHMM.`,
    );
  }

  const hours = trimmedTime.slice(0, 2);
  const minutes = trimmedTime.slice(2, 4);
  const isoString = `${trimmedDate}T${hours}:${minutes}:00.000Z`;
  const timestamp = new Date(isoString);

  if (Number.isNaN(timestamp.getTime())) {
    throw new FirmsParsingError(
      `Could not construct valid UTC date from date "${acqDate}" and time "${acqTime}".`,
    );
  }

  return {
    formattedTime: trimmedTime,
    timestamp,
  };
}

function parseOptionalNumber(val: string | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "n/a" || trimmed === "null") {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parses a single CSV line into an array of string values, handling quotes and commas.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Safely parses NASA FIRMS VIIRS NRT CSV content into normalized FirmsDetection records.
 */
export function parseFirmsCsv(
  csvContent: string,
  source: FirmsSource,
): FirmsDetection[] {
  if (!csvContent || typeof csvContent !== "string") {
    return [];
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase());

  // Check required core columns
  const latIdx = headers.indexOf("latitude");
  const lonIdx = headers.indexOf("longitude");
  const dateIdx = headers.indexOf("acq_date");
  const timeIdx = headers.indexOf("acq_time");
  const satIdx = headers.indexOf("satellite");

  if (
    latIdx === -1 ||
    lonIdx === -1 ||
    dateIdx === -1 ||
    timeIdx === -1 ||
    satIdx === -1
  ) {
    // If the response is an error message or non-CSV header (e.g. invalid map key message)
    if (
      csvContent.includes("Invalid MAP_KEY") ||
      csvContent.includes("Error:")
    ) {
      throw new FirmsParsingError(
        "FIRMS returned an error response instead of CSV data.",
      );
    }
    throw new FirmsParsingError(
      `Missing required headers in FIRMS CSV response. Found: ${headers.join(", ")}`,
    );
  }

  const confIdx = headers.indexOf("confidence");
  const frpIdx = headers.indexOf("frp");
  const ti4Idx = headers.indexOf("bright_ti4");
  const ti5Idx = headers.indexOf("bright_ti5");
  const scanIdx = headers.indexOf("scan");
  const trackIdx = headers.indexOf("track");
  const daynightIdx = headers.indexOf("daynight");
  const versionIdx = headers.indexOf("version");
  const instrumentIdx = headers.indexOf("instrument");

  const detections: FirmsDetection[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = parseCsvLine(rawLine);

    if (cols.length < headers.length) {
      continue; // Skip truncated rows
    }

    const latRaw = parseOptionalNumber(cols[latIdx]);
    const lonRaw = parseOptionalNumber(cols[lonIdx]);

    if (latRaw === null || lonRaw === null) {
      continue; // Skip rows without valid coordinates
    }

    if (latRaw < -90 || latRaw > 90 || lonRaw < -180 || lonRaw > 180) {
      continue; // Skip out-of-range coordinates
    }

    const rawDate = cols[dateIdx];
    const rawTime = cols[timeIdx];
    const rawSat = cols[satIdx];

    let satellite: FirmsSatellite;
    let acqTime: string;
    let acqTimestamp: Date;

    try {
      satellite = normalizeSatellite(rawSat, source);
      const parsedTime = parseAcquisitionTimestamp(rawDate, rawTime);
      acqTime = parsedTime.formattedTime;
      acqTimestamp = parsedTime.timestamp;
    } catch {
      continue; // Skip invalid records
    }

    const confidence = confIdx !== -1 ? cols[confIdx] || "nominal" : "nominal";
    const instrument =
      instrumentIdx !== -1 ? cols[instrumentIdx] || "VIIRS" : "VIIRS";

    detections.push({
      id: randomUUID(),
      source,
      latitude: latRaw,
      longitude: lonRaw,
      acqDate: rawDate.trim(),
      acqTime,
      acqTimestamp,
      satellite,
      instrument,
      confidence: confidence.trim(),
      frp: frpIdx !== -1 ? parseOptionalNumber(cols[frpIdx]) : null,
      brightTi4: ti4Idx !== -1 ? parseOptionalNumber(cols[ti4Idx]) : null,
      brightTi5: ti5Idx !== -1 ? parseOptionalNumber(cols[ti5Idx]) : null,
      scan: scanIdx !== -1 ? parseOptionalNumber(cols[scanIdx]) : null,
      track: trackIdx !== -1 ? parseOptionalNumber(cols[trackIdx]) : null,
      daynight: daynightIdx !== -1 ? cols[daynightIdx]?.trim() || null : null,
      version: versionIdx !== -1 ? cols[versionIdx]?.trim() || null : null,
    });
  }

  return detections;
}
