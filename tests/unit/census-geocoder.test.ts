import { describe, expect, it } from "vitest";

import { GeocoderError, geocodeWithCensus } from "@/locations/census-geocoder";

describe("census-geocoder", () => {
  it("normalizes a valid Census geocoder response", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          result: {
            input: { address: { address: "4600 Silver Hill Rd" } },
            addressMatches: [
              {
                matchedAddress: "4600 SILVER HILL RD, WASHINGTON, DC, 20233",
                coordinates: {
                  x: -76.928366,
                  y: 38.845053,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await geocodeWithCensus(
      "4600 Silver Hill Rd, Washington, DC 20233",
      { fetchFn: mockFetch as unknown as typeof fetch },
    );

    expect(result).toEqual({
      matchedAddress: "4600 SILVER HILL RD, WASHINGTON, DC, 20233",
      latitude: 38.845053,
      longitude: -76.928366,
    });
  });

  it("returns null when no address matches are found", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          result: {
            input: { address: { address: "Unknown Place" } },
            addressMatches: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await geocodeWithCensus("Fake Address Nowhere, XX 00000", {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result).toBeNull();
  });

  it("throws GeocoderError when HTTP response is not ok", async () => {
    const mockFetch = async () =>
      new Response("Internal Server Error", { status: 500 });

    await expect(
      geocodeWithCensus("123 Main St", {
        fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(GeocoderError);
  });

  it("throws GeocoderError on invalid JSON response", async () => {
    const mockFetch = async () =>
      new Response("Not valid JSON", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      geocodeWithCensus("123 Main St", {
        fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow("Received invalid response from geocoding service.");
  });

  it("throws GeocoderError on invalid coordinate ranges in response", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          result: {
            addressMatches: [
              {
                matchedAddress: "Somewhere Out of Bounds",
                coordinates: {
                  x: 999.0, // Invalid longitude
                  y: 38.84,
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    await expect(
      geocodeWithCensus("Invalid Coords", {
        fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow("Geocoding service returned invalid coordinates.");
  });

  it("handles timeout abort cleanly", async () => {
    const mockFetch = async (
      _url: string | URL | Request,
      options?: { signal?: AbortSignal },
    ) => {
      return new Promise<Response>((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        }
      });
    };

    await expect(
      geocodeWithCensus("123 Main St", {
        fetchFn: mockFetch as unknown as typeof fetch,
        timeoutMs: 10,
      }),
    ).rejects.toThrow("Geocoding service timed out.");
  });
});
