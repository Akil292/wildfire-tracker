import { createHash } from "node:crypto";

import { calculateSphericalCentroid, haversineDistanceMeters } from "@/lib/geo";

import type { NearbyFirmsDetection } from "../types";
import {
  DEFAULT_SPATIAL_THRESHOLD_METERS,
  DEFAULT_TEMPORAL_THRESHOLD_HOURS,
} from "./constants";
import type { FirmsActivityGroup, GroupingOptions } from "./types";

/**
 * Deterministically groups nearby and time-adjacent FIRMS thermal-anomaly detections
 * into activity groups using connected components (pairwise spatio-temporal graph traversal).
 *
 * Algorithm Details:
 * - Complexity: O(N^2) pairwise evaluation over N location-scoped detections, where N is
 *   the pre-filtered detection count within the user's monitoring radius and time window.
 * - Transitive connectivity: Two detections A and C are joined into the same group if there
 *   exists a chain of qualifying connections A-B and B-C.
 * - Connection Criteria (inclusive):
 *     1. Geodesic distance <= spatialThresholdMeters
 *     2. |acqTimestamp_A - acqTimestamp_B| <= temporalThresholdMs
 */
export function groupNearbyDetections(
  detections: NearbyFirmsDetection[],
  options: GroupingOptions = {},
): FirmsActivityGroup[] {
  if (detections.length === 0) {
    return [];
  }

  const spatialThreshold =
    options.spatialThresholdMeters ?? DEFAULT_SPATIAL_THRESHOLD_METERS;
  const temporalThresholdMs =
    (options.temporalThresholdHours ?? DEFAULT_TEMPORAL_THRESHOLD_HOURS) *
    3600 *
    1000;

  const n = detections.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  // 1. Build adjacency list using inclusive spatio-temporal thresholds
  for (let i = 0; i < n; i++) {
    const timeI = detections[i].acqTimestamp.getTime();
    for (let j = i + 1; j < n; j++) {
      const timeJ = detections[j].acqTimestamp.getTime();
      const timeDiff = Math.abs(timeI - timeJ);

      if (timeDiff <= temporalThresholdMs) {
        const distMeters = haversineDistanceMeters(
          detections[i].latitude,
          detections[i].longitude,
          detections[j].latitude,
          detections[j].longitude,
        );

        if (distMeters <= spatialThreshold) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
  }

  // 2. Discover connected components via Breadth-First Search
  const visited = new Array<boolean>(n).fill(false);
  const rawGroups: NearbyFirmsDetection[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const component: NearbyFirmsDetection[] = [];
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(detections[current]);

      for (const neighbor of adj[current]) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }

    rawGroups.push(component);
  }

  // 3. Construct derived activity group metadata
  const activityGroups: FirmsActivityGroup[] = rawGroups.map((members) => {
    // Sort member detections deterministically: newest first, then by ID ascending
    const sortedMembers = [...members].sort((a, b) => {
      const timeDiff = b.acqTimestamp.getTime() - a.acqTimestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    // Deterministic group ID derived from complete canonically sorted member IDs
    const memberIds = sortedMembers.map((m) => m.id).sort();
    const idHash = createHash("sha256")
      .update(memberIds.join(":"))
      .digest("hex")
      .substring(0, 16);
    const groupId = `group_${idHash}`;

    // Spherical geographic centroid
    const centroid = calculateSphericalCentroid(
      sortedMembers.map((m) => ({
        latitude: m.latitude,
        longitude: m.longitude,
      })),
    );

    // Timestamps
    let earliestTime = sortedMembers[0].acqTimestamp;
    let latestTime = sortedMembers[0].acqTimestamp;
    let minDistance = sortedMembers[0].distanceMiles;
    let maxFrpVal: number | null = null;

    const uniqueSources = new Set<NearbyFirmsDetection["source"]>();
    const uniqueSatellites = new Set<NearbyFirmsDetection["satellite"]>();

    for (const m of sortedMembers) {
      if (m.acqTimestamp.getTime() < earliestTime.getTime()) {
        earliestTime = m.acqTimestamp;
      }
      if (m.acqTimestamp.getTime() > latestTime.getTime()) {
        latestTime = m.acqTimestamp;
      }
      if (m.distanceMiles < minDistance) {
        minDistance = m.distanceMiles;
      }
      if (m.frp !== null) {
        if (maxFrpVal === null || m.frp > maxFrpVal) {
          maxFrpVal = m.frp;
        }
      }
      uniqueSources.add(m.source);
      uniqueSatellites.add(m.satellite);
    }

    return {
      id: groupId,
      detectionCount: sortedMembers.length,
      representativeLatitude: centroid.latitude,
      representativeLongitude: centroid.longitude,
      minDistanceMiles: Number(minDistance.toFixed(2)),
      earliestAcqTimestamp: earliestTime,
      latestAcqTimestamp: latestTime,
      sources: Array.from(uniqueSources).sort(),
      satellites: Array.from(uniqueSatellites).sort(),
      maxFrp: maxFrpVal !== null ? Number(maxFrpVal.toFixed(1)) : null,
      detections: sortedMembers,
    };
  });

  // 4. Deterministic ordering of groups: latest activity first, then detection count, then ID
  return activityGroups.sort((a, b) => {
    const timeDiff =
      b.latestAcqTimestamp.getTime() - a.latestAcqTimestamp.getTime();
    if (timeDiff !== 0) return timeDiff;

    const countDiff = b.detectionCount - a.detectionCount;
    if (countDiff !== 0) return countDiff;

    return a.id.localeCompare(b.id);
  });
}
