/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Menu } from 'lucide-react';
import { CurvedLinearCompass } from './components/CurvedLinearCompass';
import { MenuDrawer } from './components/MenuDrawer';
import { SpeedDisplay } from './components/SpeedDisplay';
import { useMarineTelemetry } from './hooks/useMarineTelemetry';
import { RouteWaypoint, SavedRoute, WaypointTarget } from './types/marine';
import {
  computeTrueBearing,
  haversineDistanceMeters,
  METERS_PER_NAUTICAL_MILE,
} from './utils/nautical';
import { playWaypointArrivalSound, unlockMarineAudio } from './utils/sound';

declare global {
  interface Window {
    AndroidBridge?: {
      vibrate?: (ms: number) => void;
      onArrival?: () => void;
      isNative?: () => boolean;
    };
  }
}

// Default Mediterranean coastal reference (Arcipelago di La Maddalena) when awaiting first GPS fix
const DEFAULT_BOAT_LAT = 41.1865;
const DEFAULT_BOAT_LON = 9.4125;
const LEGACY_WAYPOINT_STORAGE_KEY = 'nautica_gps_waypoint_v1';
const ACTIVE_ROUTE_STORAGE_KEY = 'nautica_gps_active_route_v2';
const SAVED_ROUTES_STORAGE_KEY = 'nautica_gps_saved_routes_v1';
const ARRIVAL_RADIUS_METERS = 35; // Standard marine arrival circle radius (~35 m)
const ARRIVAL_POPUP_DURATION_MS = 3000; // Auto-dismiss after 3 seconds

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [arrivalBanner, setArrivalBanner] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);
  const arrivalTimerRef = useRef<number | null>(null);

  const [routePoints, setRoutePoints] = useState<RouteWaypoint[]>(() => {
    try {
      const rawRoute = localStorage.getItem(ACTIVE_ROUTE_STORAGE_KEY);
      if (rawRoute) {
        const parsed = JSON.parse(rawRoute) as RouteWaypoint[];
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (p) =>
              typeof p?.id === 'string' &&
              typeof p?.lat === 'number' &&
              typeof p?.lon === 'number' &&
              Number.isFinite(p.lat) &&
              Number.isFinite(p.lon)
          );
        }
      }
      // Migrate legacy single waypoint if present
      const legacy = localStorage.getItem(LEGACY_WAYPOINT_STORAGE_KEY);
      if (legacy) {
        const wp = JSON.parse(legacy) as WaypointTarget;
        localStorage.removeItem(LEGACY_WAYPOINT_STORAGE_KEY);
        if (
          typeof wp?.lat === 'number' &&
          typeof wp?.lon === 'number' &&
          Number.isFinite(wp.lat) &&
          Number.isFinite(wp.lon)
        ) {
          return [{ id: generateId(), lat: wp.lat, lon: wp.lon }];
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_ROUTES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SavedRoute[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (r) =>
          typeof r?.id === 'string' &&
          typeof r?.name === 'string' &&
          Array.isArray(r?.points) &&
          r.points.length > 0
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (routePoints.length > 0) {
        localStorage.setItem(
          ACTIVE_ROUTE_STORAGE_KEY,
          JSON.stringify(routePoints)
        );
      } else {
        localStorage.removeItem(ACTIVE_ROUTE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted iframes
    }
  }, [routePoints]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SAVED_ROUTES_STORAGE_KEY,
        JSON.stringify(savedRoutes)
      );
    } catch {
      // Ignore storage errors
    }
  }, [savedRoutes]);

  useEffect(() => {
    return () => {
      if (arrivalTimerRef.current !== null) {
        window.clearTimeout(arrivalTimerRef.current);
      }
    };
  }, []);

  const {
    telemetry,
    waveFilter,
    setWaveFilter,
    resetTrip,
    clearTrack,
    wakeLockActive,
    wakeLockSupported,
    toggleWakeLock,
  } = useMarineTelemetry();

  const effectiveBoatLat = telemetry.latitude ?? DEFAULT_BOAT_LAT;
  const effectiveBoatLon = telemetry.longitude ?? DEFAULT_BOAT_LON;

  const activeWaypoint = routePoints.length > 0 ? routePoints[0] : null;

  // Live true bearing, next leg distance, and total multi-leg distance
  const {
    targetBearingDeg,
    nextLegDistanceNm,
    nextLegDistanceMeters,
    totalRouteDistanceNm,
  } = useMemo(() => {
    if (routePoints.length === 0) {
      return {
        targetBearingDeg: null,
        nextLegDistanceNm: null,
        nextLegDistanceMeters: null,
        totalRouteDistanceNm: null,
      };
    }

    const first = routePoints[0];
    const firstLegMeters = haversineDistanceMeters(
      effectiveBoatLat,
      effectiveBoatLon,
      first.lat,
      first.lon
    );
    const bearing = computeTrueBearing(
      effectiveBoatLat,
      effectiveBoatLon,
      first.lat,
      first.lon
    );

    let totalMeters = firstLegMeters;
    for (let i = 0; i < routePoints.length - 1; i++) {
      totalMeters += haversineDistanceMeters(
        routePoints[i].lat,
        routePoints[i].lon,
        routePoints[i + 1].lat,
        routePoints[i + 1].lon
      );
    }

    return {
      targetBearingDeg: bearing,
      nextLegDistanceNm: firstLegMeters / METERS_PER_NAUTICAL_MILE,
      nextLegDistanceMeters: firstLegMeters,
      totalRouteDistanceNm: totalMeters / METERS_PER_NAUTICAL_MILE,
    };
  }, [effectiveBoatLat, effectiveBoatLon, routePoints]);

  // Automatic deletion of reached route point + acoustic signal + 3-second popup
  useEffect(() => {
    if (
      activeWaypoint !== null &&
      nextLegDistanceMeters !== null &&
      nextLegDistanceMeters <= ARRIVAL_RADIUS_METERS
    ) {
      const remainingAfterThis = routePoints.length - 1;
      playWaypointArrivalSound();
      if (typeof window !== 'undefined' && window.AndroidBridge) {
        try {
          window.AndroidBridge.vibrate?.(600);
          window.AndroidBridge.onArrival?.();
        } catch {
          // Native bridge not available
        }
      }

      setRoutePoints((prev) =>
        prev.length > 0 && prev[0].id === activeWaypoint.id
          ? prev.slice(1)
          : prev
      );

      setArrivalBanner(
        remainingAfterThis > 0
          ? {
              title: 'Punto Raggiunto',
              subtitle: `Passaggio al punto successivo (${remainingAfterThis} ${
                remainingAfterThis === 1 ? 'punto rimasto' : 'punti rimasti'
              })`,
            }
          : {
              title: 'Rotta Completata',
              subtitle: 'Sei arrivato sulla destinazione finale',
            }
      );

      if (arrivalTimerRef.current !== null) {
        window.clearTimeout(arrivalTimerRef.current);
      }
      arrivalTimerRef.current = window.setTimeout(() => {
        setArrivalBanner(null);
        arrivalTimerRef.current = null;
      }, ARRIVAL_POPUP_DURATION_MS);
    }
  }, [activeWaypoint, nextLegDistanceMeters, routePoints.length]);

  const handleAddRoutePoint = useCallback((pt: WaypointTarget) => {
    setRoutePoints((prev) => [
      ...prev,
      { id: generateId(), lat: pt.lat, lon: pt.lon },
    ]);
  }, []);

  const handleUpdateRoutePoint = useCallback(
    (id: string, pt: WaypointTarget) => {
      setRoutePoints((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, lat: pt.lat, lon: pt.lon } : item
        )
      );
    },
    []
  );

  const handleDeleteRoutePoint = useCallback((id: string) => {
    setRoutePoints((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearActiveRoute = useCallback(() => {
    setRoutePoints([]);
  }, []);

  const handleSaveCurrentRoute = useCallback(
    (rawName: string) => {
      if (routePoints.length === 0) return;
      const trimmed = rawName.trim();
      const finalName = trimmed || `Rotta ${savedRoutes.length + 1}`;
      const newSaved: SavedRoute = {
        id: generateId(),
        name: finalName,
        points: routePoints.map((p) => ({ lat: p.lat, lon: p.lon })),
        createdAt: Date.now(),
      };
      setSavedRoutes((prev) => [newSaved, ...prev]);
    },
    [routePoints, savedRoutes.length]
  );

  const handleLoadSavedRoute = useCallback(
    (saved: SavedRoute, reverse = false) => {
      const sourcePts = reverse ? [...saved.points].reverse() : saved.points;
      setRoutePoints(
        sourcePts.map((p) => ({
          id: generateId(),
          lat: p.lat,
          lon: p.lon,
        }))
      );
    },
    []
  );

  const handleDeleteSavedRoute = useCallback((id: string) => {
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <div
      onPointerDown={unlockMarineAudio}
      className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-black text-white select-none touch-none"
    >
      {/* Minimal Top-Right Menu Trigger */}
      <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-4 z-30 touch-auto">
        <button
          type="button"
          onClick={() => {
            unlockMarineAudio();
            setMenuOpen(true);
          }}
          aria-label="Apri impostazioni, carta nautica e medie"
          aria-expanded={menuOpen}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Auto-Dismissing 3-Second Waypoint / Route Arrival Popup */}
      {arrivalBanner && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center px-6"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-yellow-400 bg-black/95 px-6 py-5 shadow-2xl flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="w-12 h-12 text-yellow-400 shrink-0" />
            <div className="text-2xl sm:text-3xl font-bold tracking-wide text-white">
              {arrivalBanner.title}
            </div>
            <div className="text-sm text-zinc-300">
              {arrivalBanner.subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Tall Top Compass (60° Curved Scale + Yellow Course Indicator & Animated Arrows) */}
      <CurvedLinearCompass
        headingDeg={telemetry.headingDeg}
        targetBearingDeg={targetBearingDeg}
      />

      {/* Raymarine i50 3-Digit "00.0" Knots Display + km/h Sub-Register */}
      <SpeedDisplay
        speedKnots={telemetry.speedKnots}
        speedKmh={telemetry.speedKmh}
      />

      {/* Top-Right Slide-Over Menu */}
      <MenuDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        telemetry={telemetry}
        boatLat={effectiveBoatLat}
        boatLon={effectiveBoatLon}
        onClearTrack={clearTrack}
        routePoints={routePoints}
        savedRoutes={savedRoutes}
        targetBearingDeg={targetBearingDeg}
        nextLegDistanceNm={nextLegDistanceNm}
        totalRouteDistanceNm={totalRouteDistanceNm}
        onAddRoutePoint={handleAddRoutePoint}
        onUpdateRoutePoint={handleUpdateRoutePoint}
        onDeleteRoutePoint={handleDeleteRoutePoint}
        onClearActiveRoute={handleClearActiveRoute}
        onSaveCurrentRoute={handleSaveCurrentRoute}
        onLoadSavedRoute={handleLoadSavedRoute}
        onDeleteSavedRoute={handleDeleteSavedRoute}
        waveFilter={waveFilter}
        onChangeWaveFilter={setWaveFilter}
        onResetTrip={resetTrip}
        wakeLockSupported={wakeLockSupported}
        wakeLockActive={wakeLockActive}
        onToggleWakeLock={toggleWakeLock}
      />
    </div>
  );
}
