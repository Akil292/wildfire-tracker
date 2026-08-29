import { describe, expect, it } from "vitest";

import {
  createLocationSchema,
  geocodeInputSchema,
  latitudeSchema,
  longitudeSchema,
  monitorRadiusSchema,
  updateLocationSchema,
} from "@/locations/validation";

describe("location-validation", () => {
  describe("latitudeSchema & longitudeSchema", () => {
    it("accepts valid coordinates", () => {
      expect(latitudeSchema.safeParse(38.845053).success).toBe(true);
      expect(latitudeSchema.safeParse(-90).success).toBe(true);
      expect(latitudeSchema.safeParse(90).success).toBe(true);
      expect(longitudeSchema.safeParse(-76.928366).success).toBe(true);
      expect(longitudeSchema.safeParse(-180).success).toBe(true);
      expect(longitudeSchema.safeParse(180).success).toBe(true);
    });

    it("rejects out-of-range coordinates", () => {
      expect(latitudeSchema.safeParse(90.1).success).toBe(false);
      expect(latitudeSchema.safeParse(-90.1).success).toBe(false);
      expect(longitudeSchema.safeParse(180.1).success).toBe(false);
      expect(longitudeSchema.safeParse(-180.1).success).toBe(false);
      expect(latitudeSchema.safeParse("invalid").success).toBe(false);
    });
  });

  describe("monitorRadiusSchema", () => {
    it("accepts valid radius within range", () => {
      expect(monitorRadiusSchema.safeParse(0.1).success).toBe(true);
      expect(monitorRadiusSchema.safeParse(25).success).toBe(true);
      expect(monitorRadiusSchema.safeParse(500).success).toBe(true);
      expect(monitorRadiusSchema.safeParse("25").success).toBe(true);
    });

    it("rejects radius out of range", () => {
      expect(monitorRadiusSchema.safeParse(0).success).toBe(false);
      expect(monitorRadiusSchema.safeParse(0.05).success).toBe(false);
      expect(monitorRadiusSchema.safeParse(501).success).toBe(false);
      expect(monitorRadiusSchema.safeParse(-10).success).toBe(false);
    });
  });

  describe("geocodeInputSchema", () => {
    it("accepts non-empty address", () => {
      const result = geocodeInputSchema.safeParse({
        address: "  4600 Silver Hill Rd, Washington, DC 20233  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe(
          "4600 Silver Hill Rd, Washington, DC 20233",
        );
      }
    });

    it("rejects empty or whitespace-only address", () => {
      expect(geocodeInputSchema.safeParse({ address: "" }).success).toBe(false);
      expect(geocodeInputSchema.safeParse({ address: "   " }).success).toBe(
        false,
      );
      expect(geocodeInputSchema.safeParse({}).success).toBe(false);
    });

    it("rejects excessively long address", () => {
      expect(
        geocodeInputSchema.safeParse({ address: "a".repeat(201) }).success,
      ).toBe(false);
    });
  });

  describe("createLocationSchema", () => {
    it("accepts valid location input with default radius", () => {
      const result = createLocationSchema.safeParse({
        label: "Home",
        address: "123 Main St, Springfield, IL",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.label).toBe("Home");
        expect(result.data.monitorRadiusMiles).toBe(25);
      }
    });

    it("accepts custom valid monitoring radius", () => {
      const result = createLocationSchema.safeParse({
        label: "Cabin",
        address: "100 Mountain Rd, Lake Tahoe, CA",
        monitorRadiusMiles: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.monitorRadiusMiles).toBe(50);
      }
    });

    it("rejects missing or empty label", () => {
      expect(
        createLocationSchema.safeParse({
          label: "",
          address: "123 Main St",
        }).success,
      ).toBe(false);
      expect(
        createLocationSchema.safeParse({
          address: "123 Main St",
        }).success,
      ).toBe(false);
    });
  });

  describe("updateLocationSchema", () => {
    it("accepts partial updates", () => {
      expect(
        updateLocationSchema.safeParse({ label: "New Label" }).success,
      ).toBe(true);
      expect(
        updateLocationSchema.safeParse({ monitorRadiusMiles: 15 }).success,
      ).toBe(true);
      expect(updateLocationSchema.safeParse({ enabled: false }).success).toBe(
        true,
      );
      expect(
        updateLocationSchema.safeParse({
          label: "New Label",
          monitorRadiusMiles: 30,
          enabled: true,
        }).success,
      ).toBe(true);
    });

    it("rejects empty update payload", () => {
      expect(updateLocationSchema.safeParse({}).success).toBe(false);
    });
  });
});
