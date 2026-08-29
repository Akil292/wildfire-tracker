import { describe, expect, it } from "vitest";

import {
  createSavedLocation,
  deleteSavedLocation,
  geocodeAddress,
  getSavedLocation,
  listSavedLocations,
  updateSavedLocation,
} from "@/locations/service";
import type {
  GeocodeResult,
  LocationRepository,
  SavedLocation,
} from "@/locations/types";

function createMockRepository(
  initial: SavedLocation[] = [],
): LocationRepository {
  const store = new Map<string, SavedLocation>(initial.map((l) => [l.id, l]));

  return {
    async create(loc) {
      store.set(loc.id, loc);
      return loc;
    },
    async findByUser(userId) {
      return Array.from(store.values()).filter((l) => l.userId === userId);
    },
    async findByIdAndUser(id, userId) {
      const loc = store.get(id);
      if (loc && loc.userId === userId) {
        return loc;
      }
      return undefined;
    },
    async update(id, userId, data) {
      const loc = store.get(id);
      if (!loc || loc.userId !== userId) {
        return undefined;
      }
      const updated = { ...loc, ...data };
      store.set(id, updated);
      return updated;
    },
    async delete(id, userId) {
      const loc = store.get(id);
      if (!loc || loc.userId !== userId) {
        return false;
      }
      return store.delete(id);
    },
  };
}

const mockGeocodeSuccess = async (): Promise<GeocodeResult> => ({
  matchedAddress: "123 MAIN ST, SPRINGFIELD, IL, 62701",
  latitude: 39.7817,
  longitude: -89.6501,
});

const mockGeocodeNoMatch = async (): Promise<null> => null;

describe("location-service", () => {
  describe("geocodeAddress", () => {
    it("returns geocoded coordinates on success", async () => {
      const result = await geocodeAddress(
        { address: "123 Main St, Springfield, IL" },
        mockGeocodeSuccess,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matchedAddress).toBe(
          "123 MAIN ST, SPRINGFIELD, IL, 62701",
        );
        expect(result.data.latitude).toBe(39.7817);
        expect(result.data.longitude).toBe(-89.6501);
      }
    });

    it("returns error when address is not found", async () => {
      const result = await geocodeAddress(
        { address: "Unknown Place" },
        mockGeocodeNoMatch,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("No matching address found");
      }
    });

    it("returns validation error on empty address", async () => {
      const result = await geocodeAddress({ address: "" }, mockGeocodeSuccess);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.address).toBeDefined();
      }
    });
  });

  describe("createSavedLocation", () => {
    it("creates a saved location with verified coordinates", async () => {
      const repo = createMockRepository();
      const result = await createSavedLocation(
        "user-1",
        {
          label: "Home",
          address: "123 Main St, Springfield, IL",
          monitorRadiusMiles: 25,
        },
        repo,
        mockGeocodeSuccess,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.userId).toBe("user-1");
        expect(result.data.label).toBe("Home");
        expect(result.data.address).toBe("123 MAIN ST, SPRINGFIELD, IL, 62701");
        expect(result.data.latitude).toBe(39.7817);
        expect(result.data.longitude).toBe(-89.6501);
        expect(result.data.monitorRadiusMiles).toBe(25);
        expect(result.data.enabled).toBe(true);
      }
    });

    it("fails when geocoding fails to resolve the address", async () => {
      const repo = createMockRepository();
      const result = await createSavedLocation(
        "user-1",
        {
          label: "Home",
          address: "Unmatchable Road",
          monitorRadiusMiles: 25,
        },
        repo,
        mockGeocodeNoMatch,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.fieldErrors?.address).toBeDefined();
      }
    });
  });

  describe("ownership & CRUD isolation", () => {
    const loc1: SavedLocation = {
      id: "loc-1",
      userId: "user-1",
      label: "User 1 Home",
      address: "123 Main St",
      latitude: 40.0,
      longitude: -80.0,
      monitorRadiusMiles: 25,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const loc2: SavedLocation = {
      id: "loc-2",
      userId: "user-2",
      label: "User 2 Home",
      address: "456 Oak St",
      latitude: 41.0,
      longitude: -81.0,
      monitorRadiusMiles: 15,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("lists only locations belonging to the requesting user", async () => {
      const repo = createMockRepository([loc1, loc2]);
      const user1Locations = await listSavedLocations("user-1", repo);
      const user2Locations = await listSavedLocations("user-2", repo);

      expect(user1Locations).toHaveLength(1);
      expect(user1Locations[0].id).toBe("loc-1");
      expect(user2Locations).toHaveLength(1);
      expect(user2Locations[0].id).toBe("loc-2");
    });

    it("retrieves location only if owned by requesting user", async () => {
      const repo = createMockRepository([loc1, loc2]);

      const found = await getSavedLocation("loc-1", "user-1", repo);
      expect(found).toBeDefined();

      const forbidden = await getSavedLocation("loc-1", "user-2", repo);
      expect(forbidden).toBeUndefined();
    });

    it("updates location only if owned by requesting user", async () => {
      const repo = createMockRepository([loc1, loc2]);

      const updated = await updateSavedLocation(
        "loc-1",
        "user-1",
        { label: "Updated Label", enabled: false },
        repo,
      );
      expect(updated.ok).toBe(true);
      if (updated.ok) {
        expect(updated.data.label).toBe("Updated Label");
        expect(updated.data.enabled).toBe(false);
      }

      const denied = await updateSavedLocation(
        "loc-1",
        "user-2",
        { label: "Hacked Label" },
        repo,
      );
      expect(denied.ok).toBe(false);
      if (!denied.ok) {
        expect(denied.message).toBe("Location not found.");
      }
    });

    it("deletes location only if owned by requesting user", async () => {
      const repo = createMockRepository([loc1, loc2]);

      const denied = await deleteSavedLocation("loc-1", "user-2", repo);
      expect(denied).toBe(false);

      const deleted = await deleteSavedLocation("loc-1", "user-1", repo);
      expect(deleted).toBe(true);

      const remaining = await listSavedLocations("user-1", repo);
      expect(remaining).toHaveLength(0);
    });
  });
});
