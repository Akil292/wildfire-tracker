import { describe, expect, it } from "vitest";

import { DEFAULT_SPATIAL_THRESHOLD_METERS } from "@/firms/grouping/constants";
import { groupNearbyDetections } from "@/firms/grouping/clusterer";
import type { NearbyFirmsDetection } from "@/firms/types";
import { calculateSphericalCentroid, haversineDistanceMeters } from "@/lib/geo";

describe("FIRMS Detection Grouping", () => {
  const baseTime = new Date("2026-09-19T12:00:00.000Z");

  function createDetection(
    id: string,
    latitude: number,
    longitude: number,
    acqTimestamp: Date,
    options: Partial<NearbyFirmsDetection> = {},
  ): NearbyFirmsDetection {
    return {
      id,
      source: "VIIRS_NOAA20_NRT",
      satellite: "N20",
      latitude,
      longitude,
      acqTimestamp,
      confidence: "nominal",
      frp: 10.0,
      distanceMiles: 5.0,
      ...options,
    };
  }

  it("handles empty detection input gracefully", () => {
    const groups = groupNearbyDetections([]);
    expect(groups).toEqual([]);
  });

  it("creates a single group for a single detection", () => {
    const d1 = createDetection("det-1", 38.8951, -77.0364, baseTime, {
      frp: 15.5,
      distanceMiles: 4.2,
      satellite: "N20",
      source: "VIIRS_NOAA20_NRT",
    });

    const groups = groupNearbyDetections([d1]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.detectionCount).toBe(1);
    expect(g.id).toMatch(/^group_[a-f0-9]{16}$/);
    expect(g.representativeLatitude).toBeCloseTo(38.8951, 4);
    expect(g.representativeLongitude).toBeCloseTo(-77.0364, 4);
    expect(g.minDistanceMiles).toBe(4.2);
    expect(g.maxFrp).toBe(15.5);
    expect(g.sources).toEqual(["VIIRS_NOAA20_NRT"]);
    expect(g.satellites).toEqual(["N20"]);
    expect(g.earliestAcqTimestamp).toEqual(baseTime);
    expect(g.latestAcqTimestamp).toEqual(baseTime);
    expect(g.detections).toHaveLength(1);
    expect(g.detections[0].id).toBe("det-1");
  });

  it("groups multiple directly connected detections within spatial and temporal thresholds", () => {
    // Two points ~1.1 km apart and 2 hours apart
    const d1 = createDetection("det-1", 38.8951, -77.0364, baseTime, {
      frp: 12.0,
      distanceMiles: 3.5,
    });
    const t2 = new Date(baseTime.getTime() + 2 * 3600 * 1000);
    const d2 = createDetection("det-2", 38.9051, -77.0364, t2, {
      frp: 25.0,
      distanceMiles: 4.1,
    });

    const groups = groupNearbyDetections([d1, d2]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.detectionCount).toBe(2);
    expect(g.earliestAcqTimestamp).toEqual(baseTime);
    expect(g.latestAcqTimestamp).toEqual(t2);
    expect(g.minDistanceMiles).toBe(3.5);
    expect(g.maxFrp).toBe(25.0);
    expect(g.detections.map((d) => d.id)).toEqual(["det-2", "det-1"]); // newest first
  });

  it("enforces transitive connectivity (A-B and B-C connects A, B, and C)", () => {
    // 1 deg latitude is approx 111 km, so 0.018 deg is approx 2.0 km.
    // A and B: ~2.0 km apart (< 3.0 km)
    // B and C: ~2.0 km apart (< 3.0 km)
    // A and C: ~4.0 km apart (> 3.0 km)
    const tA = baseTime;
    const tB = new Date(baseTime.getTime() + 1 * 3600 * 1000);
    const tC = new Date(baseTime.getTime() + 2 * 3600 * 1000);

    const latA = 38.8951;
    const latB = 38.8951 + 0.018; // ~2.0 km north
    const latC = 38.8951 + 0.036; // ~4.0 km north of A

    const distAB = haversineDistanceMeters(latA, -77.0, latB, -77.0);
    const distBC = haversineDistanceMeters(latB, -77.0, latC, -77.0);
    const distAC = haversineDistanceMeters(latA, -77.0, latC, -77.0);

    expect(distAB).toBeLessThan(DEFAULT_SPATIAL_THRESHOLD_METERS);
    expect(distBC).toBeLessThan(DEFAULT_SPATIAL_THRESHOLD_METERS);
    expect(distAC).toBeGreaterThan(DEFAULT_SPATIAL_THRESHOLD_METERS);

    const detA = createDetection("det-A", latA, -77.0, tA);
    const detB = createDetection("det-B", latB, -77.0, tB);
    const detC = createDetection("det-C", latC, -77.0, tC);

    const groups = groupNearbyDetections([detA, detB, detC]);

    expect(groups).toHaveLength(1);
    expect(groups[0].detectionCount).toBe(3);
    const memberIds = groups[0].detections.map((d) => d.id);
    expect(memberIds).toContain("det-A");
    expect(memberIds).toContain("det-B");
    expect(memberIds).toContain("det-C");
  });

  it("handles spatial threshold boundary inclusively (connected <= 3000m, separate > 3000m)", () => {
    const lat1 = 38.8951;
    const lon1 = -77.0364;

    // Approximate delta latitude for exactly 3,000 meters: 3000 / (MEAN_EARTH_RADIUS * PI / 180)
    const deltaLat3000 = (3000 / 6371008.8) * (180 / Math.PI);
    const latInside = lat1 + deltaLat3000 * 0.999; // ~2997 meters
    const latOutside = lat1 + deltaLat3000 * 1.002; // ~3006 meters

    const distInside = haversineDistanceMeters(lat1, lon1, latInside, lon1);
    const distOutside = haversineDistanceMeters(lat1, lon1, latOutside, lon1);

    expect(distInside).toBeLessThanOrEqual(3000);
    expect(distOutside).toBeGreaterThan(3000);

    const d1 = createDetection("det-1", lat1, lon1, baseTime);
    const dInside = createDetection("det-inside", latInside, lon1, baseTime);
    const dOutside = createDetection("det-outside", latOutside, lon1, baseTime);

    // Test inside boundary -> 1 group
    const groupInside = groupNearbyDetections([d1, dInside]);
    expect(groupInside).toHaveLength(1);
    expect(groupInside[0].detectionCount).toBe(2);

    // Test outside boundary -> 2 separate groups
    const groupOutside = groupNearbyDetections([d1, dOutside]);
    expect(groupOutside).toHaveLength(2);
    expect(groupOutside[0].detectionCount).toBe(1);
    expect(groupOutside[1].detectionCount).toBe(1);
  });

  it("handles temporal threshold boundary inclusively (connected <= 12h, separate > 12h)", () => {
    const lat = 38.8951;
    const lon = -77.0364;

    const t1 = baseTime;
    const tExact12h = new Date(t1.getTime() + 12 * 3600 * 1000);
    const tPast12h = new Date(t1.getTime() + 12 * 3600 * 1000 + 1000); // 12h + 1s

    const d1 = createDetection("det-1", lat, lon, t1);
    const dExact12h = createDetection("det-exact-12h", lat, lon, tExact12h);
    const dPast12h = createDetection("det-past-12h", lat, lon, tPast12h);

    // Exactly 12 hours apart -> connected in 1 group
    const groupsExact = groupNearbyDetections([d1, dExact12h]);
    expect(groupsExact).toHaveLength(1);
    expect(groupsExact[0].detectionCount).toBe(2);

    // 12 hours + 1s apart -> 2 separate groups
    const groupsPast = groupNearbyDetections([d1, dPast12h]);
    expect(groupsPast).toHaveLength(2);
    expect(groupsPast[0].detectionCount).toBe(1);
    expect(groupsPast[1].detectionCount).toBe(1);
  });

  it("separates detections that are spatially close but temporally distant", () => {
    const lat = 38.8951;
    const lon = -77.0364;
    const d1 = createDetection("det-day1", lat, lon, baseTime);
    const d2 = createDetection(
      "det-day2",
      lat,
      lon,
      new Date(baseTime.getTime() + 24 * 3600 * 1000), // 24h later
    );

    const groups = groupNearbyDetections([d1, d2]);
    expect(groups).toHaveLength(2);
  });

  it("separates detections that are temporally simultaneous but spatially distant", () => {
    const d1 = createDetection("det-dc", 38.8951, -77.0364, baseTime);
    const d2 = createDetection("det-baltimore", 39.2904, -76.6122, baseTime); // ~55 km away

    const groups = groupNearbyDetections([d1, d2]);
    expect(groups).toHaveLength(2);
  });

  it("correctly includes mixed NOAA-20 and NOAA-21 sensors in the same group", () => {
    const d1 = createDetection("det-n20", 38.8951, -77.0364, baseTime, {
      satellite: "N20",
      source: "VIIRS_NOAA20_NRT",
    });
    const d2 = createDetection(
      "det-n21",
      38.898,
      -77.038,
      new Date(baseTime.getTime() + 50 * 60 * 1000), // 50 mins later
      {
        satellite: "N21",
        source: "VIIRS_NOAA21_NRT",
      },
    );

    const groups = groupNearbyDetections([d1, d2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].satellites).toEqual(["N20", "N21"]);
    expect(groups[0].sources).toEqual(["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]);
  });

  it("produces strictly deterministic group IDs, member ordering, and group ordering regardless of input permutation", () => {
    const d1 = createDetection("det-alpha", 38.8951, -77.0364, baseTime);
    const d2 = createDetection(
      "det-beta",
      38.9051,
      -77.0364,
      new Date(baseTime.getTime() + 1 * 3600 * 1000),
    );
    const d3 = createDetection(
      "det-gamma",
      39.5,
      -77.5,
      new Date(baseTime.getTime() + 2 * 3600 * 1000),
    );

    const order1 = [d1, d2, d3];
    const order2 = [d3, d1, d2];
    const order3 = [d2, d3, d1];

    const res1 = groupNearbyDetections(order1);
    const res2 = groupNearbyDetections(order2);
    const res3 = groupNearbyDetections(order3);

    expect(res1).toEqual(res2);
    expect(res2).toEqual(res3);
  });

  it("calculates spherical centroid accurately and handles degenerate/wrap-around cases", () => {
    // Normal 2 points
    const c1 = calculateSphericalCentroid([
      { latitude: 38.0, longitude: -77.0 },
      { latitude: 40.0, longitude: -77.0 },
    ]);
    expect(c1.latitude).toBeCloseTo(39.0, 2);
    expect(c1.longitude).toBeCloseTo(-77.0, 2);

    // Empty list
    const cEmpty = calculateSphericalCentroid([]);
    expect(cEmpty).toEqual({ latitude: 0, longitude: 0 });

    // Single point
    const cSingle = calculateSphericalCentroid([
      { latitude: 42.73, longitude: -73.68 },
    ]);
    expect(cSingle).toEqual({ latitude: 42.73, longitude: -73.68 });

    // Longitude wrap-around across the antimeridian (e.g. 179° and -179°)
    const cAntimeridian = calculateSphericalCentroid([
      { latitude: 0, longitude: 179 },
      { latitude: 0, longitude: -179 },
    ]);
    expect(cAntimeridian.latitude).toBeCloseTo(0, 4);
    expect(Math.abs(cAntimeridian.longitude)).toBeCloseTo(180, 4);
  });
});
