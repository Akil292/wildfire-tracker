import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

let client: postgres.Sql | undefined;

export function getDatabase() {
  client ??= postgres(getDatabaseUrl(), { max: 1 });
  return drizzle(client, { schema });
}

export async function closeDatabaseConnection() {
  if (client) {
    await client.end();
    client = undefined;
  }
}
