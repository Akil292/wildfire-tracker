import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.url().optional(),
});

export const env = serverEnvironmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export function getDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database commands.");
  }

  return env.DATABASE_URL;
}
