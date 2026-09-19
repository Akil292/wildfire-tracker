/**
 * Default spatial grouping threshold in meters.
 *
 * NOTE: This is an application clustering threshold for grouping nearby satellite thermal-anomaly
 * pixel observations. It is NOT a scientifically validated wildfire perimeter, burn boundary,
 * or official incident classification threshold.
 */
export const DEFAULT_SPATIAL_THRESHOLD_METERS = 3000;

/**
 * Default temporal grouping threshold in hours.
 *
 * NOTE: This is an application observation window parameter chosen to bridge consecutive day/night
 * satellite overpasses of persistent thermal activity. It is NOT an official incident duration
 * or fire lifecycle metric.
 */
export const DEFAULT_TEMPORAL_THRESHOLD_HOURS = 12;
