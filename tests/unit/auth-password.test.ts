import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/auth/password";

describe("password hashing", () => {
  it("creates an Argon2id hash that verifies", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    expect(passwordHash).toContain("$argon2id$");
    await expect(
      verifyPassword(passwordHash, "correct horse battery staple"),
    ).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const passwordHash = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword(passwordHash, "incorrect password"),
    ).resolves.toBe(false);
  });

  it("rejects malformed hashes without throwing", async () => {
    await expect(
      verifyPassword("not-a-password-hash", "any password"),
    ).resolves.toBe(false);
  });
});
