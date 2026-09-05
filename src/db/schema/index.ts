import {
  boolean,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Generic application metadata for the platform itself. Domain tables are
 * intentionally deferred until later milestones.
 */
export const applicationMetadata = pgTable("application_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const savedLocations = pgTable(
  "saved_locations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    address: text("address").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    monitorRadiusMiles: real("monitor_radius_miles").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("saved_locations_user_id_idx").on(table.userId)],
);

export const firmsDetections = pgTable(
  "firms_detections",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    acqDate: text("acq_date").notNull(),
    acqTime: text("acq_time").notNull(),
    acqTimestamp: timestamp("acq_timestamp", { withTimezone: true }).notNull(),
    satellite: text("satellite").notNull(),
    instrument: text("instrument").notNull(),
    confidence: text("confidence").notNull(),
    frp: real("frp"),
    brightTi4: real("bright_ti4"),
    brightTi5: real("bright_ti5"),
    scan: real("scan"),
    track: real("track"),
    daynight: text("daynight"),
    version: text("version"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("firms_detections_unique_observation").on(
      table.source,
      table.satellite,
      table.latitude,
      table.longitude,
      table.acqDate,
      table.acqTime,
    ),
    index("firms_detections_acq_timestamp_idx").on(table.acqTimestamp),
    index("firms_detections_source_idx").on(table.source),
  ],
);
