import { describe, expect, it, vi } from "vitest";

import { getCurrentUser } from "@/auth/cookies";
import { requireUser } from "@/auth/authorization";

vi.mock("@/auth/cookies", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

describe("requireUser", () => {
  it("returns the authenticated user", async () => {
    const user = {
      id: "user-1",
      email: "person@example.com",
      createdAt: new Date(),
    };
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    await expect(requireUser()).resolves.toEqual(user);
  });

  it("redirects unauthenticated users to sign-in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(undefined);

    await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in");
  });
});
