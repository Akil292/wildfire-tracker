import { z } from "zod";

import {
  authSecretSchema,
  databaseUrlSchema,
  firmsMapKeySchema,
} from "@/schemas/environment";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: databaseUrlSchema.optional(),
  AUTH_SECRET: authSecretSchema.optional(),
  FIRMS_MAP_KEY: firmsMapKeySchema.optional(),
});

export const env = serverEnvironmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  FIRMS_MAP_KEY: process.env.FIRMS_MAP_KEY,
});

export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required for database commands.");
  }

  return dbUrl;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? env.AUTH_SECRET;
  const result = authSecretSchema.safeParse(secret);
  if (!result.success) {
    throw new Error("AUTH_SECRET is required for authentication.");
  }

  return result.data;
}

export function getFirmsMapKey(): string {
  const key = process.env.FIRMS_MAP_KEY ?? env.FIRMS_MAP_KEY;
  const result = firmsMapKeySchema.safeParse(key);
  if (!result.success) {
    throw new Error("FIRMS_MAP_KEY is required for NASA FIRMS ingestion.");
  }

  return result.data;
}
