"use client";

import { FormEvent, useState } from "react";

import type { GeocodeResult, SavedLocation } from "@/locations/types";

type LocationsManagerProps = {
  initialLocations: SavedLocation[];
};

export function LocationsManager({ initialLocations }: LocationsManagerProps) {
  const [locations, setLocations] = useState<SavedLocation[]>(initialLocations);

  // Form state
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<GeocodeResult | null>(
    null,
  );
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  async function handleGeocodePreview(e: React.MouseEvent) {
    e.preventDefault();
    if (!address.trim()) {
      setFormError("Please enter an address to look up.");
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setIsGeocoding(true);

    try {
      const res = await fetch("/api/locations/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(
          data.message || "Failed to find coordinates for that address.",
        );
        setPreviewResult(null);
      } else {
        setPreviewResult(data.result);
        setFormError(null);
      }
    } catch {
      setFormError("Unable to connect to the server. Please try again.");
    } finally {
      setIsGeocoding(false);
    }
  }

  async function handleCreateLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          address: address.trim(),
          monitorRadiusMiles: Number(radiusMiles),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || "Failed to save location.");
      } else {
        setLocations((prev) => [data.location, ...prev]);
        setFormSuccess(`Location "${data.location.label}" added successfully.`);
        // Reset form
        setLabel("");
        setAddress("");
        setRadiusMiles(25);
        setPreviewResult(null);
      }
    } catch {
      setFormError("Unable to save location. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleEnabled(loc: SavedLocation) {
    setActiveActionId(loc.id);
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !loc.enabled }),
      });

      if (res.ok) {
        const data = await res.json();
        setLocations((prev) =>
          prev.map((l) => (l.id === loc.id ? data.location : l)),
        );
      }
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this saved location?")) {
      return;
    }

    setActiveActionId(id);
    try {
      const res = await fetch(`/api/locations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLocations((prev) => prev.filter((l) => l.id !== id));
      }
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <div className="space-y-10">
      {/* Add New Location Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Add a Monitored Location
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a US address to resolve its coordinates via the US Census
          Geocoder and configure monitoring.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleCreateLocation}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="location-label"
              >
                Label (e.g., Home, College, Family)
              </label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-hidden"
                id="location-label"
                name="label"
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home"
                required
                type="text"
                value={label}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium text-slate-700"
                htmlFor="monitor-radius"
              >
                Monitoring Radius:{" "}
                <span className="font-semibold text-orange-700">
                  {radiusMiles} miles
                </span>
              </label>
              <div className="mt-1 flex items-center space-x-3">
                <input
                  className="h-2 w-full cursor-pointer accent-orange-700"
                  id="monitor-radius"
                  max="100"
                  min="1"
                  name="monitorRadiusMiles"
                  onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  step="1"
                  type="range"
                  value={radiusMiles}
                />
                <span className="text-xs whitespace-nowrap text-slate-500">
                  1 - 100 mi
                </span>
              </div>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-slate-700"
              htmlFor="location-address"
            >
              US Address
            </label>
            <div className="mt-1 flex space-x-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-hidden"
                id="location-address"
                name="address"
                onChange={(e) => {
                  setAddress(e.target.value);
                  setPreviewResult(null);
                }}
                placeholder="4600 Silver Hill Rd, Washington, DC 20233"
                required
                type="text"
                value={address}
              />
              <button
                className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                disabled={isGeocoding || !address.trim()}
                onClick={handleGeocodePreview}
                type="button"
              >
                {isGeocoding ? "Locating…" : "Preview"}
              </button>
            </div>
          </div>

          {/* Census Geocode Preview Card */}
          {previewResult && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 text-sm">
              <p className="font-medium text-orange-950">
                Census Matched Location:
              </p>
              <p className="mt-1 text-slate-700">
                {previewResult.matchedAddress}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Coordinates: {previewResult.latitude.toFixed(6)},{" "}
                {previewResult.longitude.toFixed(6)}
              </p>
            </div>
          )}

          {formError && (
            <p className="text-sm font-medium text-red-700" role="alert">
              {formError}
            </p>
          )}

          {formSuccess && (
            <p className="text-sm font-medium text-green-700" role="status">
              {formSuccess}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              className="rounded-md bg-orange-700 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
              disabled={isSaving || !label.trim() || !address.trim()}
              type="submit"
            >
              {isSaving ? "Saving Location…" : "Save Location"}
            </button>
          </div>
        </form>
      </section>

      {/* Saved Locations List */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Your Saved Locations ({locations.length})
          </h2>
        </div>

        {locations.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">
              No saved locations yet. Add a location above to start monitoring.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {locations.map((loc) => (
              <li
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                key={loc.id}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-slate-900">
                      {loc.label}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        loc.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {loc.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">{loc.address}</p>

                  <div className="mt-3 flex flex-wrap gap-y-1 text-xs text-slate-500">
                    <span className="mr-4">
                      Radius: {loc.monitorRadiusMiles} mi
                    </span>
                    <span>
                      {Number(loc.latitude).toFixed(4)},{" "}
                      {Number(loc.longitude).toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <button
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                    disabled={activeActionId === loc.id}
                    onClick={() => handleToggleEnabled(loc)}
                    type="button"
                  >
                    {loc.enabled ? "Disable" : "Enable"}
                  </button>

                  <button
                    className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    disabled={activeActionId === loc.id}
                    onClick={() => handleDelete(loc.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
