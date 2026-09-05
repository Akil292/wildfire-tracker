import { closeDatabaseConnection } from "@/db";
import { ingestFirmsData } from "@/firms/service";

async function main() {
  console.log("=== Starting NASA FIRMS VIIRS Data Ingestion ===");

  try {
    const summary = await ingestFirmsData();

    console.log("\n=== Ingestion Summary ===");
    console.log(`Saved locations processed: ${summary.locationsProcessed}`);
    console.log(`Unique monitoring areas:    ${summary.uniqueAreasQueried}`);
    console.log(`API requests attempted:    ${summary.requestsAttempted}`);
    console.log(`API requests succeeded:    ${summary.requestsSucceeded}`);
    console.log(`Observations received:     ${summary.observationsReceived}`);
    console.log(`New detections inserted:   ${summary.newRowsInserted}`);
    console.log(`Duplicate observations:    ${summary.duplicatesSkipped}`);
    console.log("=================================================");
  } catch (error: unknown) {
    console.error(
      "\nIngestion failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  } finally {
    await closeDatabaseConnection();
  }
}

main();
