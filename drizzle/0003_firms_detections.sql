CREATE TABLE IF NOT EXISTS "firms_detections" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"acq_date" text NOT NULL,
	"acq_time" text NOT NULL,
	"acq_timestamp" timestamp with time zone NOT NULL,
	"satellite" text NOT NULL,
	"instrument" text NOT NULL,
	"confidence" text NOT NULL,
	"frp" real,
	"bright_ti4" real,
	"bright_ti5" real,
	"scan" real,
	"track" real,
	"daynight" text,
	"version" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "firms_detections_latitude_check" CHECK ("latitude" >= -90.0 AND "latitude" <= 90.0),
	CONSTRAINT "firms_detections_longitude_check" CHECK ("longitude" >= -180.0 AND "longitude" <= 180.0),
	CONSTRAINT "firms_detections_satellite_check" CHECK ("satellite" IN ('N20', 'N21')),
	CONSTRAINT "firms_detections_source_check" CHECK ("source" IN ('VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT')),
	CONSTRAINT "firms_detections_unique_observation" UNIQUE ("source", "satellite", "latitude", "longitude", "acq_date", "acq_time")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firms_detections_acq_timestamp_idx" ON "firms_detections" USING btree ("acq_timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firms_detections_source_idx" ON "firms_detections" USING btree ("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "firms_detections_location_gist_idx" ON "firms_detections" USING GIST ("location");--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_firms_detections_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS firms_detections_location_trigger ON "firms_detections";
--> statement-breakpoint
CREATE TRIGGER firms_detections_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON "firms_detections"
FOR EACH ROW
EXECUTE FUNCTION update_firms_detections_location();
