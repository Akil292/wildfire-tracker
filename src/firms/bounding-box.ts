import type { BoundingBox } from "./types";

const MILES_PER_DEGREE_LATITUDE = 69.0934;
const MIN_COSINE_FACTOR = 0.01;

/**
 * Calculates a bounding box around a geographic point given a radius in miles.
 * Correctly scales longitude degrees by the cosine of latitude.
 * Clamps coordinates to valid WGS84 ranges: [-180, 180] and [-90, 90].
 */
export function calculateBoundingBox(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): BoundingBox {
  const safeRadius = Math.max(0, radiusMiles);

  const deltaLat = safeRadius / MILES_PER_DEGREE_LATITUDE;

  const latRadians = (latitude * Math.PI) / 180;
  const cosFactor = Math.max(Math.abs(Math.cos(latRadians)), MIN_COSINE_FACTOR);
  const deltaLon = safeRadius / (MILES_PER_DEGREE_LATITUDE * cosFactor);

  const south = Math.max(-90.0, Number((latitude - deltaLat).toFixed(4)));
  const north = Math.min(90.0, Number((latitude + deltaLat).toFixed(4)));
  const west = Math.max(-180.0, Number((longitude - deltaLon).toFixed(4)));
  const east = Math.min(180.0, Number((longitude + deltaLon).toFixed(4)));

  return { west, south, east, north };
}

/**
 * Formats a BoundingBox for NASA FIRMS Area API query parameter: "west,south,east,north".
 */
export function formatBoundingBoxForFirms(bbox: BoundingBox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

/**
 * Deduplicates overlapping or identical bounding boxes to avoid redundant external API calls.
 */
export function deduplicateBoundingBoxes(boxes: BoundingBox[]): BoundingBox[] {
  const seen = new Set<string>();
  const unique: BoundingBox[] = [];

  for (const box of boxes) {
    const key = formatBoundingBoxForFirms(box);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(box);
    }
  }

  return unique;
}
