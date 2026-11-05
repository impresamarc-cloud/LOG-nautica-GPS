export enum TelemetrySource {
  GPS = 'GPS',
  SIMULATOR = 'SIMULATOR',
}

export enum GpsStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  ACTIVE = 'ACTIVE',
  DENIED = 'DENIED',
  UNAVAILABLE = 'UNAVAILABLE',
  ERROR = 'ERROR',
}

export enum WaveFilterLevel {
  RAW = 'RAW',
  MEDIUM = 'MEDIUM',
  ROUGH = 'ROUGH',
}

export enum HeadingOrigin {
  GPS_COG = 'GPS_COG',
  COMPUTED_COG = 'COMPUTED_COG',
  MAGNETIC = 'MAGNETIC',
  HELD_LAST = 'HELD_LAST',
  SIMULATED = 'SIMULATED',
  NONE = 'NONE',
}

export interface WaypointTarget {
  lat: number;
  lon: number;
}

export interface RouteWaypoint {
  id: string;
  lat: number;
  lon: number;
}

export interface SavedRoute {
  id: string;
  name: string;
  points: WaypointTarget[];
  createdAt: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface SpeedSample {
  timestamp: number;
  knots: number;
  kmh: number;
  heading: number | null;
}

export interface SimulatorControls {
  targetKnots: number;
  targetHeading: number;
  seaChop: boolean;
}

export interface MarineTelemetryState {
  source: TelemetrySource;
  gpsStatus: GpsStatus;
  gpsErrorMessage: string | null;
  speedKnots: number;
  speedKmh: number;
  headingDeg: number | null;
  headingOrigin: HeadingOrigin;
  accuracyMeters: number | null;
  latitude: number | null;
  longitude: number | null;
  maxKnots: number;
  avgKnots: number;
  distanceNm: number;
  elapsedSeconds: number;
  lastUpdated: number | null;
  samples: SpeedSample[];
  track: TrackPoint[];
}
