import { z } from "zod";

const authSecretSchema = z.string().min(32);

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().optional(),
  AUTH_SECRET: authSecretSchema.optional(),
});

export const env = serverEnvironmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
});

export function getDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database commands.");
  }

  return env.DATABASE_URL;
}

export function getAuthSecret(): string {
  const result = authSecretSchema.safeParse(process.env.AUTH_SECRET);
  if (!result.success) {
    throw new Error("AUTH_SECRET is required for authentication.");
  }

  return result.data;
}
