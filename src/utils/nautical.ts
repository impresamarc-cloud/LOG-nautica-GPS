/**
 * Exact nautical conversion constants
 * 1 International Nautical Mile = 1852 meters (exact)
 * 1 Knot = 1852 m / 3600 s = 1.852 km/h (exact)
 */
export const METERS_PER_NAUTICAL_MILE = 1852;
export const KMH_PER_KNOT = 1.852;

export function msToKnots(speedMs: number): number {
  if (!Number.isFinite(speedMs) || speedMs < 0) return 0;
  return (speedMs * 3600) / METERS_PER_NAUTICAL_MILE;
}

export function msToKmh(speedMs: number): number {
  if (!Number.isFinite(speedMs) || speedMs < 0) return 0;
  return speedMs * 3.6;
}

export function knotsToKmh(knots: number): number {
  if (!Number.isFinite(knots) || knots < 0) return 0;
  return knots * KMH_PER_KNOT;
}

/**
 * Normalizes any angle in degrees into [0, 360)
 */
export function normalizeDeg360(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Shortest signed angular difference (target - current) in [-180, 180]
 */
export function shortestAngleDelta(currentDeg: number, targetDeg: number): number {
  const diff = normalizeDeg360(targetDeg - currentDeg);
  return diff > 180 ? diff - 360 : diff;
}

/**
 * Formats heading as 3-digit zero-padded integer string: 000..359
 */
export function formatHeading3Digits(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return '---';
  const rounded = Math.round(normalizeDeg360(deg)) % 360;
  return rounded.toString().padStart(3, '0');
}

/**
 * Returns cardinal code and traditional Italian Rosa dei Venti name
 */
export function getCardinalAndWind(deg: number | null): {
  cardinal: string;
  windName: string;
} {
  if (deg === null || !Number.isFinite(deg)) {
    return { cardinal: '--', windName: 'In attesa di rotta' };
  }
  const normalized = normalizeDeg360(deg);
  const sectors = [
    { cardinal: 'N', windName: 'Tramontana' },
    { cardinal: 'NE', windName: 'Grecale' },
    { cardinal: 'E', windName: 'Levante' },
    { cardinal: 'SE', windName: 'Scirocco' },
    { cardinal: 'S', windName: 'Ostro' },
    { cardinal: 'SO', windName: 'Libeccio' },
    { cardinal: 'O', windName: 'Ponente' },
    { cardinal: 'NO', windName: 'Maestrale' },
  ];
  const index = Math.round(normalized / 45) % 8;
  return sectors[index];
}

/**
 * Haversine great-circle distance in meters between two WGS84 coordinates
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Spherical forward bearing (true course) in [0, 360) from point 1 to point 2
 */
export function computeTrueBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return normalizeDeg360(toDeg(theta));
}

/**
 * Formats decimal degrees into standard marine Degrees + Decimal Minutes (DD° MM.MMM' N/S/E/O)
 */
export function formatNauticalCoord(
  value: number | null,
  isLatitude: boolean
): string {
  if (value === null || !Number.isFinite(value)) {
    return isLatitude ? "--° --.---' N" : "---° --.---' E";
  }
  const hemisphere = isLatitude
    ? value >= 0
      ? 'N'
      : 'S'
    : value >= 0
      ? 'E'
      : 'O';
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  const degPad = degrees.toString().padStart(isLatitude ? 2 : 3, '0');
  const minFormatted = minutes.toFixed(3).padStart(6, '0');
  return `${degPad}° ${minFormatted}' ${hemisphere}`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculates a destination point given starting latitude/longitude, bearing in degrees,
 * and distance in meters along a great-circle path.
 */
export function computeDestinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceMeters: number
): { lat: number; lon: number } {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const delta = distanceMeters / R;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const phi2 = Math.asin(
    sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(theta)
  );

  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * sinDelta * cosPhi1,
      cosDelta - sinPhi1 * Math.sin(phi2)
    );

  const finalLon = ((toDeg(lambda2) + 540) % 360) - 180;
  return {
    lat: toDeg(phi2),
    lon: finalLon,
  };
}
