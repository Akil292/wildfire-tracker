import { getFirmsMapKey } from "@/lib/env";

import { formatBoundingBoxForFirms } from "./bounding-box";
import type { BoundingBox, FirmsApiClient, FirmsSource } from "./types";

const FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DAY_RANGE = 1;

export class FirmsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "FirmsApiError";
  }
}

export type FirmsClientOptions = {
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
};

export class DefaultFirmsApiClient implements FirmsApiClient {
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: FirmsClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private getKey(): string {
    return this.apiKey ?? getFirmsMapKey();
  }

  async fetchDetectionsCsv(
    source: FirmsSource,
    bbox: BoundingBox,
    dayRange = DEFAULT_DAY_RANGE,
  ): Promise<string> {
    const key = this.getKey();
    const bboxStr = formatBoundingBoxForFirms(bbox);
    const dayRangeInt = Math.max(1, Math.min(10, Math.floor(dayRange)));

    // URL format: https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[WEST,SOUTH,EAST,NORTH]/[DAY_RANGE]
    const endpoint = `${FIRMS_BASE_URL}/${encodeURIComponent(key)}/${encodeURIComponent(source)}/${bboxStr}/${dayRangeInt}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: "text/csv, text/plain",
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new FirmsApiError("NASA FIRMS request timed out.");
      }
      throw new FirmsApiError("Failed to reach NASA FIRMS API.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new FirmsApiError(
          "NASA FIRMS authentication failed. Please verify FIRMS_MAP_KEY.",
          response.status,
        );
      }
      if (response.status === 429) {
        throw new FirmsApiError(
          "NASA FIRMS rate limit reached. Please try again later.",
          response.status,
        );
      }
      throw new FirmsApiError(
        `NASA FIRMS API returned HTTP status ${response.status}.`,
        response.status,
      );
    }

    const csvText = await response.text();

    // NASA FIRMS returns text with error messages for invalid keys even with HTTP 200 in some cases
    if (
      csvText.startsWith("Invalid MAP_KEY") ||
      csvText.startsWith("Bad Request") ||
      csvText.includes("Please provide a valid MAP_KEY")
    ) {
      throw new FirmsApiError(
        "NASA FIRMS rejected the MAP_KEY as invalid or expired.",
      );
    }

    return csvText;
  }
}

export const defaultFirmsClient = new DefaultFirmsApiClient();
