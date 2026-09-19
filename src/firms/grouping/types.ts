import type {
  FirmsSatellite,
  FirmsSource,
  NearbyFirmsDetection,
} from "../types";

export type FirmsActivityGroup = {
  id: string;
  detectionCount: number;
  representativeLatitude: number;
  representativeLongitude: number;
  minDistanceMiles: number;
  earliestAcqTimestamp: Date;
  latestAcqTimestamp: Date;
  sources: FirmsSource[];
  satellites: FirmsSatellite[];
  maxFrp: number | null;
  detections: NearbyFirmsDetection[];
};

export type GroupingOptions = {
  spatialThresholdMeters?: number;
  temporalThresholdHours?: number;
};
