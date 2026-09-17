export const METERS_PER_MILE = 1609.344;
const MEAN_EARTH_RADIUS_METERS = 6371008.8;

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: [number, number][][];
};

export type GeoJsonFeature<G = GeoJsonPolygon, P = Record<string, unknown>> = {
  type: "Feature";
  geometry: G;
  properties: P;
};

/**
 * Generates a GeoJSON Polygon representing a geodesic circle given center coordinates and radius in miles.
 * Uses spherical trigonometry (great-circle direct formula) along Earth's curvature.
 */
export function generateGeodesicCircle(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  points = 64,
): GeoJsonPolygon {
  const safeRadius = Math.max(0, radiusMiles);
  const radiusMeters = milesToMeters(safeRadius);
  const angularDistance = radiusMeters / MEAN_EARTH_RADIUS_METERS;

  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;

  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points;

    const pLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );

    const pLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pLatRad),
      );

    const pLat = (pLatRad * 180) / Math.PI;
    // Normalize longitude between -180 and 180
    const pLon = (((pLonRad * 180) / Math.PI + 540) % 360) - 180;

    coordinates.push([
      Number(pLon.toFixed(6)),
      Number(Math.max(-90, Math.min(90, pLat)).toFixed(6)),
    ]);
  }

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}
