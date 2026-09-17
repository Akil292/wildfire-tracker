import { describe, expect, it } from "vitest";

import {
  generateGeodesicCircle,
  metersToMiles,
  milesToMeters,
} from "@/lib/geo";

describe("geo helpers", () => {
  describe("unit conversions", () => {
    it("converts miles to meters accurately", () => {
      expect(milesToMeters(1)).toBe(1609.344);
      expect(milesToMeters(25)).toBe(40233.6);
    });

    it("converts meters to miles accurately", () => {
      expect(metersToMiles(1609.344)).toBe(1);
      expect(metersToMiles(40233.6)).toBe(25);
    });
  });

  describe("generateGeodesicCircle", () => {
    it("generates a closed polygon ring with the specified number of points", () => {
      const circle = generateGeodesicCircle(38.8951, -77.0364, 25, 64);

      expect(circle.type).toBe("Polygon");
      expect(circle.coordinates).toHaveLength(1);

      const ring = circle.coordinates[0];
      // 64 segments = 65 coordinate vertices (first equals last)
      expect(ring).toHaveLength(65);

      const first = ring[0];
      const last = ring[ring.length - 1];
      expect(first[0]).toBeCloseTo(last[0], 5);
      expect(first[1]).toBeCloseTo(last[1], 5);
    });

    it("coordinates lie within valid geographic ranges", () => {
      const circle = generateGeodesicCircle(0, 0, 50, 32);
      const ring = circle.coordinates[0];

      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    });

    it("generates expected latitude bounds at mid-latitude", () => {
      const centerLat = 40.0;
      const centerLon = -105.0;
      const radiusMiles = 69.0934; // ~1 degree latitude
      const circle = generateGeodesicCircle(
        centerLat,
        centerLon,
        radiusMiles,
        64,
      );
      const ring = circle.coordinates[0];

      const latitudes = ring.map((p) => p[1]);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);

      expect(minLat).toBeCloseTo(39.0, 1);
      expect(maxLat).toBeCloseTo(41.0, 1);
    });
  });
});

describe("DEFAULT_BASEMAP_STYLE", () => {
  it("defines a valid MapLibre raster style specification for OpenStreetMap", async () => {
    const { DEFAULT_BASEMAP_STYLE } =
      await import("@/components/map/location-map");

    expect(DEFAULT_BASEMAP_STYLE.version).toBe(8);
    expect(DEFAULT_BASEMAP_STYLE.sources).toBeDefined();

    const osmSource = (
      DEFAULT_BASEMAP_STYLE.sources as Record<
        string,
        { type: string; tiles: string[]; attribution: string }
      >
    ).osm;
    expect(osmSource).toBeDefined();
    expect(osmSource.type).toBe("raster");
    expect(osmSource.tiles).toContain(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(osmSource.attribution).toContain("OpenStreetMap");

    const layers = DEFAULT_BASEMAP_STYLE.layers;
    expect(layers).toBeDefined();
    const osmLayer = layers.find((l) => l.id === "osm-tiles");
    expect(osmLayer).toBeDefined();
    expect(osmLayer?.type).toBe("raster");
    expect((osmLayer as { source?: string }).source).toBe("osm");
  });
});
