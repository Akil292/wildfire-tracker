import { describe, expect, it } from "vitest";

import { clearAttempts, isRateLimited, recordAttempt } from "@/auth/rate-limit";

describe("authentication rate limiting", () => {
  it("limits repeated attempts within the window and clears them", () => {
    const key = `rate-limit-test-${Date.now()}`;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      recordAttempt(key, 1_000);
    }

    expect(isRateLimited(key, 1_001)).toBe(true);
    clearAttempts(key);
    expect(isRateLimited(key, 1_001)).toBe(false);
  });

  it("starts a new window after expiration", () => {
    const key = `rate-limit-expiry-${Date.now()}`;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      recordAttempt(key, 1_000);
    }

    expect(isRateLimited(key, 901_001)).toBe(false);
    clearAttempts(key);
  });
});
