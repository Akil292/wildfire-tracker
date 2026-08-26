import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Generic application metadata for the platform itself. Domain tables are
 * intentionally deferred until later milestones.
 */
export const applicationMetadata = pgTable("application_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
