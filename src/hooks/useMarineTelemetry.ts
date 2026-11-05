import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GpsStatus,
  HeadingOrigin,
  MarineTelemetryState,
  SpeedSample,
  TelemetrySource,
  TrackPoint,
  WaveFilterLevel,
} from '../types/marine';
import {
  computeTrueBearing,
  haversineDistanceMeters,
  METERS_PER_NAUTICAL_MILE,
  msToKmh,
  msToKnots,
  normalizeDeg360,
  shortestAngleDelta,
} from '../utils/nautical';

interface FixRecord {
  lat: number;
  lon: number;
  timestamp: number;
  accuracy: number;
}

const MAX_SAMPLES = 60;
const MAX_TRACK_POINTS = 2500;

export function useMarineTelemetry() {
  const [waveFilter, setWaveFilter] = useState<WaveFilterLevel>(WaveFilterLevel.MEDIUM);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [wakeLockSupported] = useState<boolean>(
    () => typeof navigator !== 'undefined' && 'wakeLock' in navigator
  );

  const [telemetry, setTelemetry] = useState<MarineTelemetryState>({
    source: TelemetrySource.GPS,
    gpsStatus: GpsStatus.SEARCHING,
    gpsErrorMessage: null,
    speedKnots: 0,
    speedKmh: 0,
    headingDeg: null,
    headingOrigin: HeadingOrigin.NONE,
    accuracyMeters: null,
    latitude: null,
    longitude: null,
    maxKnots: 0,
    avgKnots: 0,
    distanceNm: 0,
    elapsedSeconds: 0,
    lastUpdated: null,
    samples: [],
    track: [],
  });

  // Mutable refs for continuous filtering & trip integration
  const watchIdRef = useRef<number | null>(null);
  const prevFixRef = useRef<FixRecord | null>(null);
  const lastTrackPointRef = useRef<TrackPoint | null>(null);
  const smoothedSpeedMsRef = useRef<number>(0);
  const smoothedHeadingRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const speedSumKnotsRef = useRef<number>(0);
  const speedCountRef = useRef<number>(0);
  const distanceMetersRef = useRef<number>(0);
  const maxKnotsRef = useRef<number>(0);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const getAlphaForFilter = useCallback((level: WaveFilterLevel): number => {
    switch (level) {
      case WaveFilterLevel.RAW:
        return 1.0;
      case WaveFilterLevel.MEDIUM:
        return 0.42;
      case WaveFilterLevel.ROUGH:
        return 0.2;
    }
  }, []);

  const clearTrack = useCallback(() => {
    lastTrackPointRef.current = null;
    setTelemetry((prev) => {
      if (prev.latitude !== null && prev.longitude !== null) {
        const seed: TrackPoint = {
          lat: prev.latitude,
          lon: prev.longitude,
          timestamp: Date.now(),
        };
        lastTrackPointRef.current = seed;
        return { ...prev, track: [seed] };
      }
      return { ...prev, track: [] };
    });
  }, []);

  const resetTrip = useCallback(() => {
    sessionStartRef.current = Date.now();
    speedSumKnotsRef.current = 0;
    speedCountRef.current = 0;
    distanceMetersRef.current = 0;
    maxKnotsRef.current = 0;
    lastTrackPointRef.current = null;
    setTelemetry((prev) => {
      const freshTrack: TrackPoint[] =
        prev.latitude !== null && prev.longitude !== null
          ? [{ lat: prev.latitude, lon: prev.longitude, timestamp: Date.now() }]
          : [];
      if (freshTrack.length > 0) {
        lastTrackPointRef.current = freshTrack[0];
      }
      return {
        ...prev,
        maxKnots: prev.speedKnots,
        avgKnots: prev.speedKnots,
        distanceNm: 0,
        elapsedSeconds: 0,
        samples: [],
        track: freshTrack,
      };
    });
  }, []);

  // Screen Wake Lock management
  const toggleWakeLock = useCallback(async () => {
    if (!wakeLockSupported) return;
    try {
      if (wakeLockSentinelRef.current) {
        await wakeLockSentinelRef.current.release();
        wakeLockSentinelRef.current = null;
        setWakeLockActive(false);
      } else {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinelRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          wakeLockSentinelRef.current = null;
          setWakeLockActive(false);
        });
      }
    } catch {
      setWakeLockActive(false);
    }
  }, [wakeLockSupported]);

  // Session elapsed timer (1 Hz)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setTelemetry((prev) => ({
        ...prev,
        elapsedSeconds: elapsed,
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Real GPS Watch Effect (Pure GPS, high precision, rock-solid COG)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setTelemetry((prev) => ({
        ...prev,
        source: TelemetrySource.GPS,
        gpsStatus: GpsStatus.UNAVAILABLE,
        gpsErrorMessage: 'Sensore GPS non supportato su questo dispositivo.',
      }));
      return;
    }

    prevFixRef.current = null;
    setTelemetry((prev) => ({
      ...prev,
      source: TelemetrySource.GPS,
      gpsStatus: GpsStatus.SEARCHING,
      gpsErrorMessage: null,
    }));

    const alpha = getAlphaForFilter(waveFilter);

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const now = pos.timestamp || Date.now();
      const prevFix = prevFixRef.current;

      let rawSpeedMs = 0;
      let deltaDistMeters = 0;
      let dtSec = 0;

      if (prevFix) {
        dtSec = (now - prevFix.timestamp) / 1000;
        deltaDistMeters = haversineDistanceMeters(
          prevFix.lat,
          prevFix.lon,
          latitude,
          longitude
        );
      }

      if (speed !== null && Number.isFinite(speed) && speed >= 0) {
        rawSpeedMs = speed;
      } else if (prevFix && dtSec > 0.4 && dtSec < 30) {
        // Filter multipath jitter when stationary
        const jitterThreshold = Math.max(2.0, accuracy * 0.3);
        rawSpeedMs = deltaDistMeters > jitterThreshold ? deltaDistMeters / dtSec : 0;
      }

      // Stationary noise gate when moored
      if (waveFilter !== WaveFilterLevel.RAW && rawSpeedMs < 0.15 && accuracy > 12) {
        rawSpeedMs = 0;
      }

      // Apply EMA wave filter for smooth nautical speed in knots
      const filteredSpeedMs =
        alpha >= 0.99
          ? rawSpeedMs
          : smoothedSpeedMsRef.current + alpha * (rawSpeedMs - smoothedSpeedMsRef.current);
      smoothedSpeedMsRef.current = filteredSpeedMs < 0.04 ? 0 : filteredSpeedMs;

      const currentKnots = msToKnots(smoothedSpeedMsRef.current);
      const currentKmh = msToKmh(smoothedSpeedMsRef.current);

      // Distance integration when boat is actually moving (> 0.3 knots)
      const minMoveMeters = Math.max(1.8, accuracy * 0.22);
      if (prevFix && dtSec > 0 && deltaDistMeters >= minMoveMeters && currentKnots >= 0.3) {
        distanceMetersRef.current += deltaDistMeters;
      }

      // Resolve True Course Over Ground (COG)
      let resolvedHeading: number | null = smoothedHeadingRef.current;
      let resolvedOrigin: HeadingOrigin = HeadingOrigin.HELD_LAST;

      if (
        heading !== null &&
        Number.isFinite(heading) &&
        heading >= 0 &&
        currentKnots >= 0.35
      ) {
        // 1. Direct True Heading from GPS receiver chipset (Doppler COG)
        resolvedHeading = normalizeDeg360(heading);
        resolvedOrigin = HeadingOrigin.GPS_COG;
      } else if (
        prevFix &&
        deltaDistMeters >= Math.max(2.2, accuracy * 0.25) &&
        currentKnots >= 0.35
      ) {
        // 2. Calculated True Bearing from successive GPS fixes
        resolvedHeading = computeTrueBearing(
          prevFix.lat,
          prevFix.lon,
          latitude,
          longitude
        );
        resolvedOrigin = HeadingOrigin.COMPUTED_COG;
      } else {
        // 3. Stationary / moored (< 0.35 knots): HOLD the last known stable heading!
        // No jumping, spinning, or magnetic noise!
        resolvedHeading = smoothedHeadingRef.current;
        resolvedOrigin = HeadingOrigin.HELD_LAST;
      }

      // Smooth circular angle update
      if (resolvedHeading !== null) {
        if (smoothedHeadingRef.current === null || alpha >= 0.99) {
          smoothedHeadingRef.current = resolvedHeading;
        } else {
          const deltaAngle = shortestAngleDelta(smoothedHeadingRef.current, resolvedHeading);
          const damping = Math.min(1, Math.max(0.25, alpha * 0.75));
          smoothedHeadingRef.current = normalizeDeg360(
            smoothedHeadingRef.current + damping * deltaAngle
          );
        }
      }

      // Update max speed and average speed
      if (currentKnots > maxKnotsRef.current) {
        maxKnotsRef.current = currentKnots;
      }
      if (currentKnots >= 0.2) {
        speedSumKnotsRef.current += currentKnots;
        speedCountRef.current += 1;
      }
      const avgKnots =
        speedCountRef.current > 0
          ? speedSumKnotsRef.current / speedCountRef.current
          : 0;

      // Update fix record for next interval
      if (!prevFix || deltaDistMeters >= 2.0 || dtSec >= 2.0) {
        prevFixRef.current = {
          lat: latitude,
          lon: longitude,
          timestamp: now,
          accuracy,
        };
      }

      const sample: SpeedSample = {
        timestamp: Date.now(),
        knots: currentKnots,
        kmh: currentKmh,
        heading: smoothedHeadingRef.current,
      };

      // GPS Track breadcrumbs
      let nextTrackPoint: TrackPoint | null = null;
      const lastTp = lastTrackPointRef.current;
      const trackMinMove = Math.max(3.5, accuracy * 0.25);
      if (!lastTp) {
        nextTrackPoint = { lat: latitude, lon: longitude, timestamp: now };
        lastTrackPointRef.current = nextTrackPoint;
      } else {
        const distFromLastTp = haversineDistanceMeters(
          lastTp.lat,
          lastTp.lon,
          latitude,
          longitude
        );
        if (distFromLastTp >= trackMinMove) {
          nextTrackPoint = { lat: latitude, lon: longitude, timestamp: now };
          lastTrackPointRef.current = nextTrackPoint;
        }
      }

      setTelemetry((prev) => ({
        ...prev,
        source: TelemetrySource.GPS,
        gpsStatus: GpsStatus.ACTIVE,
        gpsErrorMessage: null,
        speedKnots: currentKnots,
        speedKmh: currentKmh,
        headingDeg: smoothedHeadingRef.current,
        headingOrigin: resolvedOrigin,
        accuracyMeters: accuracy,
        latitude,
        longitude,
        maxKnots: maxKnotsRef.current,
        avgKnots,
        distanceNm: distanceMetersRef.current / METERS_PER_NAUTICAL_MILE,
        lastUpdated: Date.now(),
        samples: [...prev.samples.slice(-(MAX_SAMPLES - 1)), sample],
        track: nextTrackPoint
          ? [...prev.track.slice(-(MAX_TRACK_POINTS - 1)), nextTrackPoint]
          : prev.track,
      }));
    };

    const onError = (err: GeolocationPositionError) => {
      let status = GpsStatus.ERROR;
      let message = 'Impossibile acquisire il segnale GPS.';

      if (err.code === err.PERMISSION_DENIED) {
        status = GpsStatus.DENIED;
        message = 'Permesso GPS negato. Abilita la geolocalizzazione nelle impostazioni dell\'app.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        status = GpsStatus.UNAVAILABLE;
        message = 'Posizione GPS non disponibile. Verifica la visibilità del cielo.';
      } else if (err.code === err.TIMEOUT) {
        status = GpsStatus.SEARCHING;
        message = 'Ricerca satelliti GPS ad alta precisione in corso...';
      }

      setTelemetry((prev) => ({
        ...prev,
        gpsStatus: status,
        gpsErrorMessage: message,
      }));
    };

    const id = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [waveFilter, getAlphaForFilter]);

  return {
    telemetry,
    waveFilter,
    setWaveFilter,
    resetTrip,
    clearTrack,
    wakeLockActive,
    wakeLockSupported,
    toggleWakeLock,
  };
}
