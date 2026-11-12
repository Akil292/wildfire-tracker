import { describe, expect, it } from "vitest";

import {
  formatCoordinates,
  formatTimestamp,
} from "@/components/map/activity-group-detail";
import { groupNearbyDetections } from "@/firms/grouping/clusterer";
import type { NearbyFirmsDetection } from "@/firms/types";

describe("Activity Group Detail Production Logic", () => {
  describe("formatCoordinates", () => {
    it("formats positive latitude and positive longitude (NE quadrant)", () => {
      const result = formatCoordinates(38.8977, 77.0365);
      expect(result).toBe("38.89770°N, 77.03650°E");
    });

    it("formats positive latitude and negative longitude (NW quadrant)", () => {
      const result = formatCoordinates(38.8451, -76.9284);
      expect(result).toBe("38.84510°N, 76.92840°W");
    });

    it("formats negative latitude and positive longitude (SE quadrant)", () => {
      const result = formatCoordinates(-33.8688, 151.2093);
      expect(result).toBe("33.86880°S, 151.20930°E");
    });

    it("formats negative latitude and negative longitude (SW quadrant)", () => {
      const result = formatCoordinates(-22.9068, -43.1729);
      expect(result).toBe("22.90680°S, 43.17290°W");
    });

    it("handles equator and prime meridian boundaries (0, 0)", () => {
      const result = formatCoordinates(0, 0);
      expect(result).toBe("0.00000°N, 0.00000°E");
    });

    it("preserves exact 5-decimal precision without rounding artifacts", () => {
      const result = formatCoordinates(42.1, -71.25);
      expect(result).toBe("42.10000°N, 71.25000°W");
    });
  });

  describe("formatTimestamp", () => {
    it("formats Date instance into UTC and local strings", () => {
      const date = new Date("2026-11-12T14:30:00.000Z");
      const { utc, local } = formatTimestamp(date);
      expect(utc).toBe(date.toUTCString());
      expect(local).toBe(date.toLocaleString());
    });

    it("formats ISO string input into UTC and local strings", () => {
      const iso = "2026-11-12T18:45:00.000Z";
      const { utc, local } = formatTimestamp(iso);
      expect(utc).toBe(new Date(iso).toUTCString());
      expect(local).toBe(new Date(iso).toLocaleString());
    });
  });

  describe("Group clustering and member detection data integrity", () => {
    const baseTime = new Date("2026-11-12T12:00:00.000Z");

    it("correctly handles detections with null FRP without producing invalid numbers", () => {
      const detectionsWithNullFrp: NearbyFirmsDetection[] = [
        {
          id: "det-null-1",
          source: "VIIRS_NOAA20_NRT",
          satellite: "N20",
          latitude: 38.8451,
          longitude: -76.9284,
          acqTimestamp: baseTime,
          confidence: "nominal",
          frp: null,
          distanceMiles: 4.8,
        },
        {
          id: "det-null-2",
          source: "VIIRS_NOAA21_NRT",
          satellite: "N21",
          latitude: 38.846,
          longitude: -76.929,
          acqTimestamp: new Date(baseTime.getTime() + 1000 * 60 * 30),
          confidence: "low",
          frp: null,
          distanceMiles: 4.9,
        },
      ];

      const groups = groupNearbyDetections(detectionsWithNullFrp);
      expect(groups).toHaveLength(1);
      expect(groups[0].maxFrp).toBeNull();
      expect(groups[0].detectionCount).toBe(2);
      expect(groups[0].minDistanceMiles).toBe(4.8);
      expect(groups[0].detections[0].frp).toBeNull();
      expect(groups[0].detections[1].frp).toBeNull();
    });

    it("correctly identifies max FRP when one member has null FRP and another has numeric FRP", () => {
      const mixedDetections: NearbyFirmsDetection[] = [
        {
          id: "det-mixed-1",
          source: "VIIRS_NOAA20_NRT",
          satellite: "N20",
          latitude: 38.8451,
          longitude: -76.9284,
          acqTimestamp: baseTime,
          confidence: "nominal",
          frp: null,
          distanceMiles: 4.8,
        },
        {
          id: "det-mixed-2",
          source: "VIIRS_NOAA21_NRT",
          satellite: "N21",
          latitude: 38.846,
          longitude: -76.929,
          acqTimestamp: new Date(baseTime.getTime() + 1000 * 60 * 30),
          confidence: "high",
          frp: 34.6,
          distanceMiles: 5.1,
        },
      ];

      const groups = groupNearbyDetections(mixedDetections);
      expect(groups).toHaveLength(1);
      expect(groups[0].maxFrp).toBe(34.6);
      expect(groups[0].minDistanceMiles).toBe(4.8);
      expect(groups[0].satellites).toEqual(["N20", "N21"]);
    });

    it("preserves single-detection group structure with matching earliest and latest timestamps", () => {
      const singleDetection: NearbyFirmsDetection[] = [
        {
          id: "det-solo",
          source: "VIIRS_NOAA20_NRT",
          satellite: "N20",
          latitude: 38.8951,
          longitude: -77.0364,
          acqTimestamp: baseTime,
          confidence: "high",
          frp: 15.2,
          distanceMiles: 2.3,
        },
      ];

      const groups = groupNearbyDetections(singleDetection);
      expect(groups).toHaveLength(1);
      expect(groups[0].detectionCount).toBe(1);
      expect(groups[0].earliestAcqTimestamp).toEqual(baseTime);
      expect(groups[0].latestAcqTimestamp).toEqual(baseTime);
      expect(groups[0].detections).toHaveLength(1);
      expect(groups[0].detections[0].id).toBe("det-solo");
    });
  });
});
