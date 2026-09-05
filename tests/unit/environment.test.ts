import { describe, expect, it } from "vitest";

import { getFirmsMapKey } from "@/lib/env";
import { databaseUrlSchema, firmsMapKeySchema } from "@/schemas/environment";

describe("databaseUrlSchema", () => {
  it("accepts a PostgreSQL connection URL", () => {
    expect(
      databaseUrlSchema.safeParse(
        "postgresql://user:password@localhost:5432/db",
      ).success,
    ).toBe(true);
  });

  it("rejects a non-URL value", () => {
    expect(databaseUrlSchema.safeParse("not-a-url").success).toBe(false);
  });
});

describe("firmsMapKeySchema", () => {
  it("accepts valid non-empty map key", () => {
    expect(firmsMapKeySchema.safeParse("abc123def456").success).toBe(true);
  });

  it("rejects empty map key", () => {
    expect(firmsMapKeySchema.safeParse("").success).toBe(false);
  });
});

describe("getFirmsMapKey", () => {
  it("throws clear error when FIRMS_MAP_KEY is missing", () => {
    const original = process.env.FIRMS_MAP_KEY;
    try {
      delete process.env.FIRMS_MAP_KEY;
      expect(() => getFirmsMapKey()).toThrow(
        "FIRMS_MAP_KEY is required for NASA FIRMS ingestion.",
      );
    } finally {
      process.env.FIRMS_MAP_KEY = original;
    }
  });

  it("returns key when FIRMS_MAP_KEY is set", () => {
    const original = process.env.FIRMS_MAP_KEY;
    try {
      process.env.FIRMS_MAP_KEY = "test_firms_key_12345";
      expect(getFirmsMapKey()).toBe("test_firms_key_12345");
    } finally {
      process.env.FIRMS_MAP_KEY = original;
    }
  });
});
