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
 * Computes great-circle geodesic distance in meters between two geographic coordinates
 * using the Haversine formula on a spherical Earth model.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lon1Rad = (lon1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lon2Rad = (lon2 * Math.PI) / 180;

  const dLat = lat2Rad - lat1Rad;
  const dLon = lon2Rad - lon1Rad;

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const a =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinHalfDLon * sinHalfDLon;

  const c =
    2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

  return MEAN_EARTH_RADIUS_METERS * c;
}

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

/**
 * Computes the spherical geographic centroid of a collection of coordinates by converting
 * latitude and longitude to 3D Cartesian unit vectors, averaging the vectors, and converting back.
 * Handles longitude wrap-around and includes fallback protection for degenerate/antipodal coordinates.
 */
export function calculateSphericalCentroid(
  coordinates: GeoCoordinate[],
): GeoCoordinate {
  if (coordinates.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  if (coordinates.length === 1) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
    };
  }

  let totalX = 0;
  let totalY = 0;
  let totalZ = 0;

  for (const coord of coordinates) {
    const latRad = (coord.latitude * Math.PI) / 180;
    const lonRad = (coord.longitude * Math.PI) / 180;

    totalX += Math.cos(latRad) * Math.cos(lonRad);
    totalY += Math.cos(latRad) * Math.sin(lonRad);
    totalZ += Math.sin(latRad);
  }

  const avgX = totalX / coordinates.length;
  const avgY = totalY / coordinates.length;
  const avgZ = totalZ / coordinates.length;

  const hyp = Math.sqrt(avgX * avgX + avgY * avgY);
  const magnitude = Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);

  // If coordinates are exact antipodal opposites or cancel out, fallback safely to the first coordinate
  if (magnitude < 1e-7) {
    return {
      latitude: coordinates[0].latitude,
      longitude: coordinates[0].longitude,
    };
  }

  const latRad = Math.atan2(avgZ, hyp);
  const lonRad = Math.atan2(avgY, avgX);

  const latDeg = (latRad * 180) / Math.PI;
  const lonDeg = (((lonRad * 180) / Math.PI + 540) % 360) - 180;

  return {
    latitude: Number(Math.max(-90, Math.min(90, latDeg)).toFixed(6)),
    longitude: Number(lonDeg.toFixed(6)),
  };
}

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
