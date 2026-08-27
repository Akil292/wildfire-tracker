import { createHmac, randomBytes } from "node:crypto";

import { getAuthSecret } from "@/lib/env";

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(
  token: string,
  secret = getAuthSecret(),
): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}
