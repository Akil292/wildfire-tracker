import { z } from "zod";

import type { GeocodeResult } from "./types";
import { latitudeSchema, longitudeSchema } from "./validation";

const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const DEFAULT_TIMEOUT_MS = 10_000;

const censusResponseSchema = z.object({
  result: z.object({
    addressMatches: z
      .array(
        z.object({
          matchedAddress: z.string().min(1),
          coordinates: z.object({
            x: z.number(), // Longitude
            y: z.number(), // Latitude
          }),
        }),
      )
      .default([]),
  }),
});

export class GeocoderError extends Error {
  constructor(
    message: string,
    public readonly isClientError = false,
  ) {
    super(message);
    this.name = "GeocoderError";
  }
}

export type GeocodeOptions = {
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export async function geocodeWithCensus(
  address: string,
  options: GeocodeOptions = {},
): Promise<GeocodeResult | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const customFetch = options.fetchFn ?? fetch;

  const url = new URL(CENSUS_GEOCODER_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await customFetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeocoderError("Geocoding service timed out. Please try again.");
    }
    throw new GeocoderError(
      "Unable to reach the geocoding service. Please try again later.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new GeocoderError("Geocoding service returned an unexpected error.");
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GeocoderError(
      "Received invalid response from geocoding service.",
    );
  }

  const parsed = censusResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new GeocoderError("Unable to parse geocoding service response.");
  }

  const matches = parsed.data.result.addressMatches;
  if (matches.length === 0) {
    return null;
  }

  const firstMatch = matches[0];
  const latitude = firstMatch.coordinates.y;
  const longitude = firstMatch.coordinates.x;

  const latResult = latitudeSchema.safeParse(latitude);
  const lonResult = longitudeSchema.safeParse(longitude);

  if (!latResult.success || !lonResult.success) {
    throw new GeocoderError("Geocoding service returned invalid coordinates.");
  }

  return {
    matchedAddress: firstMatch.matchedAddress,
    latitude: latResult.data,
    longitude: lonResult.data,
  };
}
