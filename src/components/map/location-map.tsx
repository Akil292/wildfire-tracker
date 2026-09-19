"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { FirmsActivityGroup, NearbyFirmsDetection } from "@/firms/types";
import { generateGeodesicCircle } from "@/lib/geo";
import type { SavedLocation } from "@/locations/types";

// OpenStreetMap standard raster basemap style for development & low-traffic portfolio demonstration.
// Easily swappable for a production tile provider when configured.
export const DEFAULT_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

type LocationMapProps = {
  location: SavedLocation;
  detections: NearbyFirmsDetection[];
  activityGroups?: FirmsActivityGroup[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
};

export function LocationMap({
  location,
  detections,
  activityGroups = [],
  isLoading = false,
  error = null,
  onRefresh,
}: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  const [selectedDetection, setSelectedDetection] =
    useState<NearbyFirmsDetection | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<FirmsActivityGroup | null>(
    null,
  );

  const showGroupPopup = useCallback(
    (g: FirmsActivityGroup, map: maplibregl.Map) => {
      if (popupRef.current) {
        popupRef.current.remove();
      }

      const earliestStr = new Date(g.earliestAcqTimestamp).toLocaleString();
      const latestStr = new Date(g.latestAcqTimestamp).toLocaleString();

      const popupContent = document.createElement("div");
      popupContent.className = "p-2 text-xs space-y-1.5 text-slate-800";
      popupContent.innerHTML = `
        <div class="font-bold text-sm text-orange-950 border-b border-orange-200 pb-1">
          FIRMS Thermal-Anomaly Activity Group
        </div>
        <div class="text-[11px] text-slate-600 font-medium pt-0.5">
          ${g.detectionCount} satellite detections (within 3 km & 12 hrs)
        </div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 pt-1">
          <span class="text-slate-500 font-medium">Satellites:</span>
          <span class="font-semibold text-slate-900">${g.satellites.join(", ")}</span>

          <span class="text-slate-500 font-medium">Max FRP:</span>
          <span class="font-semibold text-slate-900">${g.maxFrp !== null ? `${g.maxFrp} MW` : "N/A"}</span>

          <span class="text-slate-500 font-medium">Closest Distance:</span>
          <span class="font-bold text-orange-700">${g.minDistanceMiles} mi from ${location.label}</span>
        </div>
        <div class="pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
          <div><strong>Earliest:</strong> ${earliestStr}</div>
          <div><strong>Latest:</strong> ${latestStr}</div>
        </div>
        <div class="pt-1 text-[10px] text-slate-400 italic">
          * Symbolic activity cluster; not an official fire boundary.
        </div>
      `;

      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
        .setLngLat([g.representativeLongitude, g.representativeLatitude])
        .setDOMContent(popupContent)
        .addTo(map);
    },
    [location.label],
  );

  const showDetectionPopup = useCallback(
    (d: NearbyFirmsDetection, map: maplibregl.Map) => {
      if (popupRef.current) {
        popupRef.current.remove();
      }

      const dateObj = new Date(d.acqTimestamp);
      const utcTime = dateObj.toUTCString();
      const localTime = dateObj.toLocaleString();

      const popupContent = document.createElement("div");
      popupContent.className = "p-2 text-xs space-y-1.5 text-slate-800";
      popupContent.innerHTML = `
        <div class="font-bold text-sm text-orange-950 border-b border-orange-200 pb-1">
          FIRMS Thermal-Anomaly Detection
        </div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 pt-1">
          <span class="text-slate-500 font-medium">Satellite:</span>
          <span class="font-semibold text-slate-900">${d.satellite} (${d.source})</span>
          
          <span class="text-slate-500 font-medium">Confidence:</span>
          <span class="capitalize font-semibold text-slate-900">${d.confidence}</span>
          
          <span class="text-slate-500 font-medium">FRP:</span>
          <span class="font-semibold text-slate-900">${d.frp !== null ? `${d.frp} MW` : "N/A"}</span>
          
          <span class="text-slate-500 font-medium">Distance:</span>
          <span class="font-bold text-orange-700">${d.distanceMiles} mi from ${location.label}</span>
        </div>
        <div class="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
          <div><strong>UTC:</strong> ${utcTime}</div>
          <div><strong>Local:</strong> ${localTime}</div>
        </div>
      `;

      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
        .setLngLat([d.longitude, d.latitude])
        .setDOMContent(popupContent)
        .addTo(map);
    },
    [location.label],
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DEFAULT_BASEMAP_STYLE,
      center: [location.longitude, location.latitude],
      zoom: 9,
      attributionControl: { compact: false },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center, saved location marker, radius circle, and detection layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateLayers = () => {
      // 1. Update Saved Location Center Marker
      if (locationMarkerRef.current) {
        locationMarkerRef.current.remove();
      }

      const markerEl = document.createElement("div");
      markerEl.className = "flex flex-col items-center cursor-pointer";
      markerEl.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-blue-400 opacity-60"></span>
          <div class="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-md">
            <svg class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        </div>
        <span class="mt-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs">${location.label}</span>
      `;

      locationMarkerRef.current = new maplibregl.Marker({ element: markerEl })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);

      // 2. Add / Update Geodesic Radius Polygon
      const circlePolygon = generateGeodesicCircle(
        location.latitude,
        location.longitude,
        location.monitorRadiusMiles,
      );

      const radiusGeoJson = {
        type: "Feature" as const,
        geometry: circlePolygon,
        properties: {
          label: location.label,
          radiusMiles: location.monitorRadiusMiles,
        },
      };

      const sourceId = "location-radius-source";
      const fillLayerId = "location-radius-fill";
      const lineLayerId = "location-radius-line";

      const existingSource = map.getSource(
        sourceId,
      ) as maplibregl.GeoJSONSource;
      if (existingSource) {
        existingSource.setData(radiusGeoJson);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: radiusGeoJson,
        });

        map.addLayer({
          id: fillLayerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#3b82f6",
            "fill-opacity": 0.08,
          },
        });

        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#2563eb",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }

      // 3. Add / Update Activity Groups Layer (for multi-detection clusters)
      const multiDetectionGroups = activityGroups.filter(
        (g) => g.detectionCount >= 2,
      );

      const groupsGeoJson = {
        type: "FeatureCollection" as const,
        features: multiDetectionGroups.map((g) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [g.representativeLongitude, g.representativeLatitude],
          },
          properties: {
            id: g.id,
            detectionCount: g.detectionCount,
            minDistanceMiles: g.minDistanceMiles,
            maxFrp: g.maxFrp,
          },
        })),
      };

      const groupsSourceId = "activity-groups-source";
      const groupsLayerId = "activity-groups-layer";
      const groupsHaloId = "activity-groups-halo";

      const existingGroupsSource = map.getSource(
        groupsSourceId,
      ) as maplibregl.GeoJSONSource;

      if (existingGroupsSource) {
        existingGroupsSource.setData(groupsGeoJson);
      } else {
        map.addSource(groupsSourceId, {
          type: "geojson",
          data: groupsGeoJson,
        });

        // Symbolic halo around the representative centroid of multi-detection clusters
        map.addLayer({
          id: groupsHaloId,
          type: "circle",
          source: groupsSourceId,
          paint: {
            "circle-radius": 18,
            "circle-color": "#ea580c",
            "circle-opacity": 0.15,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#c2410c",
          },
        });

        map.addLayer({
          id: groupsLayerId,
          type: "circle",
          source: groupsSourceId,
          paint: {
            "circle-radius": 10,
            "circle-color": "#c2410c",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Interactive Click on Group Centroid
        map.on("click", groupsLayerId, (e: maplibregl.MapLayerMouseEvent) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const props = feature.properties;
          const matched = activityGroups.find((g) => g.id === props.id);
          if (matched) {
            setSelectedGroup(matched);
            setSelectedDetection(null);
            showGroupPopup(matched, map);
          }
        });

        map.on("mouseenter", groupsLayerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", groupsLayerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // 4. Add / Update FIRMS Detections GeoJSON Layer
      const detectionsGeoJson = {
        type: "FeatureCollection" as const,
        features: detections.map((d) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [d.longitude, d.latitude],
          },
          properties: {
            id: d.id,
            source: d.source,
            satellite: d.satellite,
            confidence: d.confidence,
            frp: d.frp,
            acqTimestamp: d.acqTimestamp,
            distanceMiles: d.distanceMiles,
          },
        })),
      };

      const detectionsSourceId = "firms-detections-source";
      const detectionsLayerId = "firms-detections-layer";
      const detectionsGlowId = "firms-detections-glow";

      const existingDetectionsSource = map.getSource(
        detectionsSourceId,
      ) as maplibregl.GeoJSONSource;

      if (existingDetectionsSource) {
        existingDetectionsSource.setData(detectionsGeoJson);
      } else {
        map.addSource(detectionsSourceId, {
          type: "geojson",
          data: detectionsGeoJson,
        });

        map.addLayer({
          id: detectionsGlowId,
          type: "circle",
          source: detectionsSourceId,
          paint: {
            "circle-radius": 10,
            "circle-color": "#f97316",
            "circle-opacity": 0.4,
          },
        });

        map.addLayer({
          id: detectionsLayerId,
          type: "circle",
          source: detectionsSourceId,
          paint: {
            "circle-radius": 5,
            "circle-color": "#ea580c",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Interactive Click on Detection Point
        map.on(
          "click",
          detectionsLayerId,
          (e: maplibregl.MapLayerMouseEvent) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const props = feature.properties;
            const matched = detections.find((d) => d.id === props.id);
            if (matched) {
              setSelectedDetection(matched);
              setSelectedGroup(null);
              showDetectionPopup(matched, map);
            }
          },
        );

        map.on("mouseenter", detectionsLayerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", detectionsLayerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Fit map to radius bounds
      const ring = circlePolygon.coordinates[0];
      const bounds = ring.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(
          [location.longitude, location.latitude],
          [location.longitude, location.latitude],
        ),
      );

      map.fitBounds(bounds, { padding: 40, maxZoom: 12 });
    };

    if (map.isStyleLoaded()) {
      updateLayers();
    } else {
      map.once("load", updateLayers);
    }
  }, [
    location,
    detections,
    activityGroups,
    showDetectionPopup,
    showGroupPopup,
  ]);

  return (
    <div className="flex flex-col space-y-4">
      {/* Map Header & Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            {location.label} &mdash; Monitoring Area Map
          </h3>
          <p className="text-xs text-slate-500">
            Displaying configured {location.monitorRadiusMiles}-mile monitoring
            radius, activity groups, and satellite-detected thermal anomalies
            (last 24 hours).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              disabled={isLoading}
              onClick={onRefresh}
              type="button"
            >
              {isLoading ? "Refreshing…" : "Refresh Detections"}
            </button>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs">
        <div className="h-full w-full" ref={mapContainerRef} />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs">
            <div className="flex items-center space-x-2 rounded-lg bg-white px-4 py-2 shadow-md">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-700 border-t-transparent"></span>
              <span className="text-xs font-medium text-slate-700">
                Loading nearby detections…
              </span>
            </div>
          </div>
        )}

        {/* Map Legend Overlay */}
        <div className="absolute bottom-6 left-3 space-y-1.5 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-md backdrop-blur-xs">
          <div className="text-[11px] font-semibold tracking-wider text-slate-900 uppercase">
            Map Legend
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full border border-white bg-blue-600"></span>
            <span className="font-medium text-slate-700">Saved Location</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-blue-600 bg-blue-100/50"></span>
            <span className="text-slate-700">
              Monitoring Radius ({location.monitorRadiusMiles} mi)
            </span>
          </div>
          {activityGroups.some((g) => g.detectionCount >= 2) && (
            <div className="flex items-center space-x-2">
              <span className="h-3.5 w-3.5 rounded-full border border-white bg-orange-800 ring-2 ring-orange-400"></span>
              <span className="font-medium text-slate-700">
                Activity Group (cluster)
              </span>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full border border-white bg-orange-600"></span>
            <span className="font-medium text-slate-700">
              FIRMS Detection ({detections.length})
            </span>
          </div>
        </div>
      </div>

      {/* Error Message Banner */}
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-800"
          role="alert"
        >
          <p className="font-semibold">Unable to load nearby detections</p>
          <p className="mt-0.5 text-red-700">{error}</p>
        </div>
      )}

      {/* Detections & Groups Status */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        {detections.length === 0 && !isLoading ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              No FIRMS thermal-anomaly detections were found within this
              monitoring radius during the last 24 hours.
            </p>
            <p className="text-xs text-slate-600">
              Note: FIRMS records represent satellite-observed thermal
              anomalies. Absence of detections does not guarantee absence of
              fire due to cloud cover, satellite orbit timing, or detection
              limits. Non-wildfire heat sources (such as industrial activity)
              may also register as thermal anomalies.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Detected Thermal Anomalies ({detections.length})
                </p>
                <p className="text-xs text-slate-500">
                  {activityGroups.length} Activity{" "}
                  {activityGroups.length === 1 ? "Group" : "Groups"} (grouped by
                  &le; 3 km distance &amp; &le; 12 hrs)
                </p>
              </div>
              <span className="text-xs text-slate-500">Last 24 Hours</span>
            </div>

            {/* Activity Groups Summary Cards */}
            {activityGroups.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold tracking-wider text-slate-700 uppercase">
                  Activity Groups ({activityGroups.length})
                </div>
                <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                  {activityGroups.map((g, idx) => {
                    const isSelected = selectedGroup?.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => {
                          setSelectedGroup(g);
                          setSelectedDetection(null);
                          if (mapRef.current) {
                            mapRef.current.flyTo({
                              center: [
                                g.representativeLongitude,
                                g.representativeLatitude,
                              ],
                              zoom: 11,
                            });
                            showGroupPopup(g, mapRef.current);
                          }
                        }}
                        className={`flex flex-col rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          isSelected
                            ? "border-orange-500 bg-orange-50/70"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                        type="button"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>
                            Group #{idx + 1} ({g.detectionCount}{" "}
                            {g.detectionCount === 1
                              ? "detection"
                              : "detections"}
                            )
                          </span>
                          <span className="font-bold text-orange-700">
                            {g.minDistanceMiles} mi
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Satellites: {g.satellites.join(", ")}</span>
                          <span>
                            {g.maxFrp !== null
                              ? `Max: ${g.maxFrp} MW`
                              : "FRP: N/A"}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          Latest:{" "}
                          {new Date(g.latestAcqTimestamp).toLocaleString()}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Individual Detections List */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold tracking-wider text-slate-700 uppercase">
                Individual Observations ({detections.length})
              </div>
              <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {detections.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDetection(d);
                      setSelectedGroup(null);
                      if (mapRef.current) {
                        mapRef.current.flyTo({
                          center: [d.longitude, d.latitude],
                          zoom: 11,
                        });
                        showDetectionPopup(d, mapRef.current);
                      }
                    }}
                    className={`flex flex-col rounded-lg border p-2 text-left text-xs transition-colors ${
                      selectedDetection?.id === d.id
                        ? "border-orange-500 bg-orange-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>
                        {d.satellite} ({d.source})
                      </span>
                      <span className="font-bold text-orange-700">
                        {d.distanceMiles} mi
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="capitalize">Conf: {d.confidence}</span>
                      <span>{d.frp !== null ? `${d.frp} MW` : "FRP: N/A"}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {new Date(d.acqTimestamp).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="border-t border-slate-200 pt-1 text-[11px] text-slate-500">
              Note: Activity groups are automated clusters of spatially and
              temporally adjacent NASA FIRMS thermal-anomaly pixel observations
              (thresholds: 3.0 km distance, 12 hours). They do not represent
              confirmed wildfire incidents, official perimeters, or fire-spread
              predictions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
