import { describe, expect, it } from "vitest";

import {
  FirmsParsingError,
  normalizeSatellite,
  parseAcquisitionTimestamp,
  parseCsvLine,
  parseFirmsCsv,
} from "@/firms/parser";

describe("firms-parser", () => {
  describe("normalizeSatellite", () => {
    it("normalizes NOAA-20 variants to N20", () => {
      expect(normalizeSatellite("20", "VIIRS_NOAA20_NRT")).toBe("N20");
      expect(normalizeSatellite("N20", "VIIRS_NOAA20_NRT")).toBe("N20");
      expect(normalizeSatellite("NOAA-20", "VIIRS_NOAA20_NRT")).toBe("N20");
      expect(normalizeSatellite("JPSS-1", "VIIRS_NOAA20_NRT")).toBe("N20");
    });

    it("normalizes NOAA-21 variants to N21", () => {
      expect(normalizeSatellite("21", "VIIRS_NOAA21_NRT")).toBe("N21");
      expect(normalizeSatellite("N21", "VIIRS_NOAA21_NRT")).toBe("N21");
      expect(normalizeSatellite("NOAA-21", "VIIRS_NOAA21_NRT")).toBe("N21");
      expect(normalizeSatellite("JPSS-2", "VIIRS_NOAA21_NRT")).toBe("N21");
    });

    it("rejects mismatched satellite for source", () => {
      expect(() => normalizeSatellite("21", "VIIRS_NOAA20_NRT")).toThrow(
        FirmsParsingError,
      );
      expect(() => normalizeSatellite("20", "VIIRS_NOAA21_NRT")).toThrow(
        FirmsParsingError,
      );
    });
  });

  describe("parseAcquisitionTimestamp", () => {
    it("parses valid date and 4-digit time into UTC Date", () => {
      const { formattedTime, timestamp } = parseAcquisitionTimestamp(
        "2026-09-04",
        "0930",
      );
      expect(formattedTime).toBe("0930");
      expect(timestamp.toISOString()).toBe("2026-09-04T09:30:00.000Z");
    });

    it("pads 3-digit time to 4 digits", () => {
      const { formattedTime, timestamp } = parseAcquisitionTimestamp(
        "2026-09-04",
        "930",
      );
      expect(formattedTime).toBe("0930");
      expect(timestamp.toISOString()).toBe("2026-09-04T09:30:00.000Z");
    });

    it("rejects invalid date or time format", () => {
      expect(() => parseAcquisitionTimestamp("09/04/2026", "0930")).toThrow(
        FirmsParsingError,
      );
      expect(() => parseAcquisitionTimestamp("2026-09-04", "2500")).toThrow(
        FirmsParsingError,
      );
      expect(() => parseAcquisitionTimestamp("2026-09-04", "invalid")).toThrow(
        FirmsParsingError,
      );
    });
  });

  describe("parseCsvLine", () => {
    it("splits comma-separated line with trimmed values", () => {
      const line = "37.5, -122.2, 320.5, 0.4, 0.38, 2026-09-04, 0930, 20";
      expect(parseCsvLine(line)).toEqual([
        "37.5",
        "-122.2",
        "320.5",
        "0.4",
        "0.38",
        "2026-09-04",
        "0930",
        "20",
      ]);
    });

    it("handles quoted commas correctly", () => {
      const line = '37.5,"-122.2, US",320.5';
      expect(parseCsvLine(line)).toEqual(["37.5", "-122.2, US", "320.5"]);
    });
  });

  describe("parseFirmsCsv", () => {
    const sampleNoaa20Csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
38.8451,-76.9284,325.4,0.45,0.39,2026-09-04,0930,20,VIIRS,nominal,2.0NRT,285.6,12.4,N
38.8500,-76.9300,340.1,0.45,0.39,2026-09-04,0930,N20,VIIRS,high,2.0NRT,290.0,25.0,N`;

    const sampleNoaa21Csv = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
34.0500,-118.2500,315.0,0.50,0.40,2026-09-04,1845,21,VIIRS,low,2.0NRT,280.0,8.5,D`;

    it("parses valid NOAA-20 CSV records", () => {
      const detections = parseFirmsCsv(sampleNoaa20Csv, "VIIRS_NOAA20_NRT");

      expect(detections).toHaveLength(2);

      const d1 = detections[0];
      expect(d1.source).toBe("VIIRS_NOAA20_NRT");
      expect(d1.satellite).toBe("N20");
      expect(d1.latitude).toBe(38.8451);
      expect(d1.longitude).toBe(-76.9284);
      expect(d1.acqDate).toBe("2026-09-04");
      expect(d1.acqTime).toBe("0930");
      expect(d1.acqTimestamp.toISOString()).toBe("2026-09-04T09:30:00.000Z");
      expect(d1.instrument).toBe("VIIRS");
      expect(d1.confidence).toBe("nominal");
      expect(d1.frp).toBe(12.4);
      expect(d1.brightTi4).toBe(325.4);
      expect(d1.brightTi5).toBe(285.6);
      expect(d1.scan).toBe(0.45);
      expect(d1.track).toBe(0.39);
      expect(d1.daynight).toBe("N");
      expect(d1.version).toBe("2.0NRT");

      const d2 = detections[1];
      expect(d2.satellite).toBe("N20");
      expect(d2.confidence).toBe("high");
      expect(d2.frp).toBe(25.0);
    });

    it("parses valid NOAA-21 CSV records", () => {
      const detections = parseFirmsCsv(sampleNoaa21Csv, "VIIRS_NOAA21_NRT");

      expect(detections).toHaveLength(1);
      const d1 = detections[0];
      expect(d1.source).toBe("VIIRS_NOAA21_NRT");
      expect(d1.satellite).toBe("N21");
      expect(d1.latitude).toBe(34.05);
      expect(d1.longitude).toBe(-118.25);
      expect(d1.acqTime).toBe("1845");
      expect(d1.acqTimestamp.toISOString()).toBe("2026-09-04T18:45:00.000Z");
      expect(d1.confidence).toBe("low");
      expect(d1.daynight).toBe("D");
    });

    it("returns empty array for empty or header-only CSV", () => {
      expect(parseFirmsCsv("", "VIIRS_NOAA20_NRT")).toEqual([]);
      expect(
        parseFirmsCsv(
          "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n",
          "VIIRS_NOAA20_NRT",
        ),
      ).toEqual([]);
    });

    it("throws FirmsParsingError when response is an API error text", () => {
      expect(() =>
        parseFirmsCsv("Invalid MAP_KEY", "VIIRS_NOAA20_NRT"),
      ).toThrow(FirmsParsingError);
    });

    it("throws FirmsParsingError when required headers are missing", () => {
      expect(() =>
        parseFirmsCsv("some,random,headers\n1,2,3", "VIIRS_NOAA20_NRT"),
      ).toThrow(FirmsParsingError);
    });

    it("skips invalid data rows gracefully", () => {
      const csvWithBadRow = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
invalid_lat,-76.9284,325.4,0.45,0.39,2026-09-04,0930,20,VIIRS,nominal,2.0NRT,285.6,12.4,N
38.8451,-76.9284,325.4,0.45,0.39,2026-09-04,0930,20,VIIRS,nominal,2.0NRT,285.6,12.4,N`;

      const detections = parseFirmsCsv(csvWithBadRow, "VIIRS_NOAA20_NRT");
      expect(detections).toHaveLength(1);
      expect(detections[0].latitude).toBe(38.8451);
    });
  });
});
