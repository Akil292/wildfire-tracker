import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeDatabaseConnection, getDatabase } from "../src/db";

async function main() {
  try {
    await migrate(getDatabase(), { migrationsFolder: "drizzle" });
    console.log("Database migrations completed.");
  } finally {
    await closeDatabaseConnection();
  }
}

void main();
