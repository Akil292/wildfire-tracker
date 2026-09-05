import { describe, expect, it } from "vitest";

import {
  calculateBoundingBox,
  deduplicateBoundingBoxes,
  formatBoundingBoxForFirms,
} from "@/firms/bounding-box";

describe("firms-bounding-box", () => {
  describe("calculateBoundingBox", () => {
    it("calculates a bounding box around a point at mid-latitude", () => {
      // Near Washington DC (~38.9° N, -77.0° W), 25-mile radius
      const bbox = calculateBoundingBox(38.8951, -77.0364, 25);

      // Delta lat ~ 25 / 69.09 ~ 0.3618 deg
      expect(bbox.south).toBeCloseTo(38.5333, 2);
      expect(bbox.north).toBeCloseTo(39.2569, 2);

      // Delta lon ~ 25 / (69.09 * cos(38.8951°)) ~ 25 / (69.09 * 0.7783) ~ 0.4649 deg
      expect(bbox.west).toBeCloseTo(-77.5013, 2);
      expect(bbox.east).toBeCloseTo(-76.5715, 2);
    });

    it("calculates larger longitude delta at higher latitudes due to cosine scaling", () => {
      const equatorBbox = calculateBoundingBox(0, 0, 69.0934);
      const highLatBbox = calculateBoundingBox(60, 0, 69.0934);

      const equatorLonSpan = equatorBbox.east - equatorBbox.west;
      const highLatLonSpan = highLatBbox.east - highLatBbox.west;

      // At 60° N, cos(60°) = 0.5, so lon span should be approximately double that at equator
      expect(highLatLonSpan).toBeGreaterThan(equatorLonSpan * 1.8);
    });

    it("clamps coordinates to valid WGS84 ranges near poles and antimeridian", () => {
      const nearNorthPole = calculateBoundingBox(89.5, 0, 100);
      expect(nearNorthPole.north).toBe(90.0);

      const nearSouthPole = calculateBoundingBox(-89.5, 0, 100);
      expect(nearSouthPole.south).toBe(-90.0);

      const nearWestEdge = calculateBoundingBox(0, -179.8, 100);
      expect(nearWestEdge.west).toBe(-180.0);

      const nearEastEdge = calculateBoundingBox(0, 179.8, 100);
      expect(nearEastEdge.east).toBe(180.0);
    });

    it("handles zero radius cleanly", () => {
      const bbox = calculateBoundingBox(34.05, -118.25, 0);
      expect(bbox.south).toBe(34.05);
      expect(bbox.north).toBe(34.05);
      expect(bbox.west).toBe(-118.25);
      expect(bbox.east).toBe(-118.25);
    });
  });

  describe("formatBoundingBoxForFirms", () => {
    it("formats bounding box as 'west,south,east,north'", () => {
      const bbox = { west: -120.5, south: 35.2, east: -119.5, north: 36.2 };
      expect(formatBoundingBoxForFirms(bbox)).toBe("-120.5,35.2,-119.5,36.2");
    });
  });

  describe("deduplicateBoundingBoxes", () => {
    it("removes identical bounding boxes", () => {
      const box1 = { west: -120.5, south: 35.2, east: -119.5, north: 36.2 };
      const box2 = { west: -120.5, south: 35.2, east: -119.5, north: 36.2 };
      const box3 = { west: -80.0, south: 40.0, east: -79.0, north: 41.0 };

      const result = deduplicateBoundingBoxes([box1, box2, box3]);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(box1);
      expect(result[1]).toEqual(box3);
    });
  });
});
