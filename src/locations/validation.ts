import { z } from "zod";

export const MIN_MONITOR_RADIUS_MILES = 0.1;
export const MAX_MONITOR_RADIUS_MILES = 500.0;
export const DEFAULT_MONITOR_RADIUS_MILES = 25.0;

export const latitudeSchema = z
  .number({ message: "Latitude must be a number." })
  .min(-90, "Latitude must be between -90 and 90.")
  .max(90, "Latitude must be between -90 and 90.");

export const longitudeSchema = z
  .number({ message: "Longitude must be a number." })
  .min(-180, "Longitude must be between -180 and 180.")
  .max(180, "Longitude must be between -180 and 180.");

export const monitorRadiusSchema = z.coerce
  .number({ message: "Monitoring radius must be a number." })
  .min(
    MIN_MONITOR_RADIUS_MILES,
    `Monitoring radius must be at least ${MIN_MONITOR_RADIUS_MILES} miles.`,
  )
  .max(
    MAX_MONITOR_RADIUS_MILES,
    `Monitoring radius must be at most ${MAX_MONITOR_RADIUS_MILES} miles.`,
  );

export const geocodeInputSchema = z.object({
  address: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(200, "Address must be 200 characters or fewer."),
});

export const createLocationSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Label is required.")
    .max(64, "Label must be 64 characters or fewer."),
  address: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(200, "Address must be 200 characters or fewer."),
  monitorRadiusMiles: monitorRadiusSchema.default(DEFAULT_MONITOR_RADIUS_MILES),
});

export const updateLocationSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Label cannot be empty.")
      .max(64, "Label must be 64 characters or fewer.")
      .optional(),
    monitorRadiusMiles: monitorRadiusSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.label !== undefined ||
      data.monitorRadiusMiles !== undefined ||
      data.enabled !== undefined,
    {
      message: "At least one field must be updated.",
    },
  );

export type GeocodeInput = z.infer<typeof geocodeInputSchema>;
export type CreateLocationSchemaInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationSchemaInput = z.infer<typeof updateLocationSchema>;
