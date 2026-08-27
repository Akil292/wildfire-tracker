import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/auth/validation";

describe("authentication validation", () => {
  it("normalizes sign-up email addresses", () => {
    const result = signUpSchema.safeParse({
      email: "  PERSON@Example.COM ",
      password: "a sufficiently long password",
      passwordConfirmation: "a sufficiently long password",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("person@example.com");
    }
  });

  it("rejects short or mismatched sign-up passwords", () => {
    const result = signUpSchema.safeParse({
      email: "person@example.com",
      password: "too-short",
      passwordConfirmation: "different-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password must be at least 12 characters.",
      );
      expect(result.error.flatten().fieldErrors.passwordConfirmation).toContain(
        "Passwords do not match.",
      );
    }
  });

  it("requires a password when signing in", () => {
    const result = signInSchema.safeParse({
      email: "person@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
