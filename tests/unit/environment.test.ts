import { describe, expect, it } from "vitest";

import { databaseUrlSchema } from "@/schemas/environment";

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
