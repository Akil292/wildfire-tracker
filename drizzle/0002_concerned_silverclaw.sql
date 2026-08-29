CREATE TABLE IF NOT EXISTS "saved_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"location" geography(Point, 4326) NOT NULL,
	"monitor_radius_miles" real NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_locations_latitude_check" CHECK ("latitude" >= -90.0 AND "latitude" <= 90.0),
	CONSTRAINT "saved_locations_longitude_check" CHECK ("longitude" >= -180.0 AND "longitude" <= 180.0),
	CONSTRAINT "saved_locations_monitor_radius_miles_check" CHECK ("monitor_radius_miles" >= 0.1 AND "monitor_radius_miles" <= 500.0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_locations" ADD CONSTRAINT "saved_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_locations_user_id_idx" ON "saved_locations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_locations_location_gist_idx" ON "saved_locations" USING GIST ("location");--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_saved_locations_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS saved_locations_location_trigger ON "saved_locations";
--> statement-breakpoint
CREATE TRIGGER saved_locations_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON "saved_locations"
FOR EACH ROW
EXECUTE FUNCTION update_saved_locations_location();