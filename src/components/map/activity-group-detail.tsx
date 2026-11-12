"use client";

import type { FirmsActivityGroup, NearbyFirmsDetection } from "@/firms/types";

type ActivityGroupDetailProps = {
  group: FirmsActivityGroup;
  locationLabel: string;
  onClose: () => void;
};

/** Format a Date (or ISO string from JSON) to both UTC and local strings. */
export function formatTimestamp(ts: Date | string): {
  utc: string;
  local: string;
} {
  const d = ts instanceof Date ? ts : new Date(ts);
  return {
    utc: d.toUTCString(),
    local: d.toLocaleString(),
  };
}

/**
 * Formats signed latitude and longitude into cardinal direction notation:
 * - Positive latitude: N
 * - Negative latitude: S
 * - Positive longitude: E
 * - Negative longitude: W
 * Preserves 5 decimal places of precision.
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latVal = Number(lat);
  const lngVal = Number(lng);
  const latDir = latVal >= 0 ? "N" : "S";
  const lngDir = lngVal >= 0 ? "E" : "W";
  return `${Math.abs(latVal).toFixed(5)}°${latDir}, ${Math.abs(lngVal).toFixed(5)}°${lngDir}`;
}

function DetectionRow({
  detection,
  index,
  locationLabel,
}: {
  detection: NearbyFirmsDetection;
  index: number;
  locationLabel: string;
}) {
  const { utc, local } = formatTimestamp(detection.acqTimestamp);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">
          #{index + 1} &mdash; {detection.satellite} ({detection.source})
        </span>
        <span className="font-bold text-orange-700">
          {detection.distanceMiles} mi from {locationLabel}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
        <span className="font-medium text-slate-500">Coordinates:</span>
        <span>
          {formatCoordinates(detection.latitude, detection.longitude)}
        </span>

        <span className="font-medium text-slate-500">Confidence:</span>
        <span className="capitalize">
          {detection.confidence ?? (
            <span className="text-slate-400 italic">N/A</span>
          )}
        </span>

        <span className="font-medium text-slate-500">FRP:</span>
        <span>
          {detection.frp !== null && detection.frp !== undefined
            ? `${detection.frp} MW`
            : "N/A"}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
        <div>
          <strong>UTC:</strong> {utc}
        </div>
        <div>
          <strong>Local:</strong> {local}
        </div>
      </div>
    </li>
  );
}

/**
 * Activity Group Detail Panel.
 *
 * Displays metadata and member satellite thermal-anomaly detections for a
 * selected FIRMS activity group.
 *
 * Activity groups are automatically computed clusters of spatially and
 * temporally adjacent NASA FIRMS observations. They do NOT represent
 * confirmed wildfires, official incident boundaries, or fire-spread
 * predictions.
 */
export function ActivityGroupDetail({
  group,
  locationLabel,
  onClose,
}: ActivityGroupDetailProps) {
  const earliest = formatTimestamp(group.earliestAcqTimestamp);
  const latest = formatTimestamp(group.latestAcqTimestamp);

  return (
    <div
      aria-label="Activity group detail"
      className="rounded-xl border border-orange-300 bg-orange-50/60 p-4 shadow-xs"
      data-testid="activity-group-detail"
      role="region"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold tracking-tight text-orange-950">
            Activity Group Detail
          </h4>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
            {group.id}
          </p>
        </div>
        <button
          aria-label="Close detail view"
          className="shrink-0 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          onClick={onClose}
          type="button"
        >
          ✕ Close
        </button>
      </div>

      {/* Key metadata grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="font-medium text-slate-500">Detections:</span>{" "}
          <span className="font-semibold text-slate-900">
            {group.detectionCount}
          </span>
        </div>

        <div>
          <span className="font-medium text-slate-500">Closest:</span>{" "}
          <span className="font-bold text-orange-700">
            {group.minDistanceMiles} mi from {locationLabel}
          </span>
        </div>

        <div>
          <span className="font-medium text-slate-500">Satellites:</span>{" "}
          <span className="font-semibold text-slate-900">
            {group.satellites.join(", ")}
          </span>
        </div>

        <div>
          <span className="font-medium text-slate-500">Max FRP:</span>{" "}
          <span className="font-semibold text-slate-900">
            {group.maxFrp !== null && group.maxFrp !== undefined
              ? `${group.maxFrp} MW`
              : "N/A"}
          </span>
        </div>

        <div className="col-span-2">
          <span className="font-medium text-slate-500">Representative:</span>{" "}
          <span className="font-semibold text-slate-900">
            {formatCoordinates(
              group.representativeLatitude,
              group.representativeLongitude,
            )}
          </span>
        </div>

        <div className="col-span-2 space-y-0.5 text-[11px] text-slate-500">
          <div>
            <strong>Earliest (UTC):</strong> {earliest.utc}
          </div>
          <div>
            <strong>Earliest (Local):</strong> {earliest.local}
          </div>
          <div>
            <strong>Latest (UTC):</strong> {latest.utc}
          </div>
          <div>
            <strong>Latest (Local):</strong> {latest.local}
          </div>
        </div>

        {group.sources.length > 0 && (
          <div className="col-span-2">
            <span className="font-medium text-slate-500">Sources:</span>{" "}
            <span className="font-semibold text-slate-900">
              {group.sources.join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Member detections */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-700 uppercase">
          Member Thermal-Anomaly Detections ({group.detections.length})
        </div>
        {group.detections.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            No member detections available.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {group.detections.map((d, i) => (
              <DetectionRow
                detection={d}
                index={i}
                key={d.id}
                locationLabel={locationLabel}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Factual non-wildfire disclaimer */}
      <p className="mt-3 border-t border-orange-200 pt-2 text-[11px] text-slate-500 italic">
        ⚠ Activity groups are automated clusters of spatially and temporally
        adjacent NASA FIRMS satellite thermal-anomaly observations (≤&thinsp;3
        km, ≤&thinsp;12 hrs). They do not represent confirmed wildfires,
        official incident boundaries, or fire-spread predictions.
      </p>
    </div>
  );
}
