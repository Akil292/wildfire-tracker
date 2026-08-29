import { randomUUID } from "node:crypto";

import { geocodeWithCensus, GeocoderError } from "./census-geocoder";
import { drizzleLocationRepository } from "./repository";
import type { GeocodeResult, LocationRepository, SavedLocation } from "./types";
import {
  createLocationSchema,
  geocodeInputSchema,
  updateLocationSchema,
} from "./validation";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export async function geocodeAddress(
  input: unknown,
  geocoderFn = geocodeWithCensus,
): Promise<ServiceResult<GeocodeResult>> {
  const parsed = geocodeInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please provide a valid address.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await geocoderFn(parsed.data.address);
    if (!result) {
      return {
        ok: false,
        message:
          "No matching address found. Please verify the address and try again.",
      };
    }
    return { ok: true, data: result };
  } catch (error: unknown) {
    if (error instanceof GeocoderError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "An unexpected error occurred while geocoding the address.",
    };
  }
}

export async function createSavedLocation(
  userId: string,
  input: unknown,
  repository: LocationRepository = drizzleLocationRepository,
  geocoderFn = geocodeWithCensus,
): Promise<ServiceResult<SavedLocation>> {
  const parsed = createLocationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let geocodeResult: GeocodeResult | null;
  try {
    geocodeResult = await geocoderFn(parsed.data.address);
  } catch (error: unknown) {
    if (error instanceof GeocoderError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: "Unable to verify address coordinates. Please try again.",
    };
  }

  if (!geocodeResult) {
    return {
      ok: false,
      message: "No matching US address could be found for that location.",
      fieldErrors: {
        address: ["Address could not be resolved by the Census geocoder."],
      },
    };
  }

  const now = new Date();
  const location: SavedLocation = {
    id: randomUUID(),
    userId,
    label: parsed.data.label,
    address: geocodeResult.matchedAddress,
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
    monitorRadiusMiles: parsed.data.monitorRadiusMiles,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const saved = await repository.create(location);
    return { ok: true, data: saved };
  } catch {
    return {
      ok: false,
      message: "Failed to save location to the database. Please try again.",
    };
  }
}

export async function listSavedLocations(
  userId: string,
  repository: LocationRepository = drizzleLocationRepository,
): Promise<SavedLocation[]> {
  return repository.findByUser(userId);
}

export async function getSavedLocation(
  id: string,
  userId: string,
  repository: LocationRepository = drizzleLocationRepository,
): Promise<SavedLocation | undefined> {
  return repository.findByIdAndUser(id, userId);
}

export async function updateSavedLocation(
  id: string,
  userId: string,
  input: unknown,
  repository: LocationRepository = drizzleLocationRepository,
): Promise<ServiceResult<SavedLocation>> {
  const parsed = updateLocationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const existing = await repository.findByIdAndUser(id, userId);
  if (!existing) {
    return {
      ok: false,
      message: "Location not found.",
    };
  }

  const updateData: Partial<
    Pick<
      SavedLocation,
      "label" | "monitorRadiusMiles" | "enabled" | "updatedAt"
    >
  > = {
    updatedAt: new Date(),
  };

  if (parsed.data.label !== undefined) {
    updateData.label = parsed.data.label;
  }
  if (parsed.data.monitorRadiusMiles !== undefined) {
    updateData.monitorRadiusMiles = parsed.data.monitorRadiusMiles;
  }
  if (parsed.data.enabled !== undefined) {
    updateData.enabled = parsed.data.enabled;
  }

  const updated = await repository.update(id, userId, updateData);
  if (!updated) {
    return {
      ok: false,
      message: "Location not found.",
    };
  }

  return { ok: true, data: updated };
}

export async function deleteSavedLocation(
  id: string,
  userId: string,
  repository: LocationRepository = drizzleLocationRepository,
): Promise<boolean> {
  return repository.delete(id, userId);
}
