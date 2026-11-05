import React, { useEffect, useState } from 'react';
import { Download, RotateCcw, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  GpsStatus,
  MarineTelemetryState,
  RouteWaypoint,
  SavedRoute,
  WaveFilterLevel,
  WaypointTarget,
} from '../types/marine';
import { formatDuration, formatNauticalCoord } from '../utils/nautical';
import { NauticalWaypointMap } from './NauticalWaypointMap';
import { SpeedChart } from './SpeedChart';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: MarineTelemetryState;
  boatLat: number;
  boatLon: number;
  onClearTrack: () => void;
  routePoints: RouteWaypoint[];
  savedRoutes: SavedRoute[];
  targetBearingDeg: number | null;
  nextLegDistanceNm: number | null;
  totalRouteDistanceNm: number | null;
  onAddRoutePoint: (pt: WaypointTarget) => void;
  onUpdateRoutePoint: (id: string, pt: WaypointTarget) => void;
  onDeleteRoutePoint: (id: string) => void;
  onClearActiveRoute: () => void;
  onSaveCurrentRoute: (name: string) => void;
  onLoadSavedRoute: (route: SavedRoute, reverse?: boolean) => void;
  onDeleteSavedRoute: (id: string) => void;
  waveFilter: WaveFilterLevel;
  onChangeWaveFilter: (level: WaveFilterLevel) => void;
  onResetTrip: () => void;
  wakeLockSupported: boolean;
  wakeLockActive: boolean;
  onToggleWakeLock: () => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  telemetry,
  boatLat,
  boatLon,
  onClearTrack,
  routePoints,
  savedRoutes,
  targetBearingDeg,
  nextLegDistanceNm,
  totalRouteDistanceNm,
  onAddRoutePoint,
  onUpdateRoutePoint,
  onDeleteRoutePoint,
  onClearActiveRoute,
  onSaveCurrentRoute,
  onLoadSavedRoute,
  onDeleteSavedRoute,
  waveFilter,
  onChangeWaveFilter,
  onResetTrip,
  wakeLockSupported,
  wakeLockActive,
  onToggleWakeLock,
}) => {
  const [justReset, setJustReset] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleReset = () => {
    onResetTrip();
    setJustReset(true);
    window.setTimeout(() => setJustReset(false), 1800);
  };

  const getGpsStatusText = () => {
    switch (telemetry.gpsStatus) {
      case GpsStatus.ACTIVE:
        return telemetry.accuracyMeters !== null
          ? `● GPS attivo · ±${Math.round(telemetry.accuracyMeters)} m`
          : '● GPS attivo';
      case GpsStatus.SEARCHING:
        return '▲ Ricerca segnale GPS...';
      case GpsStatus.DENIED:
        return '✖ Permesso GPS negato';
      default:
        return '✖ Segnale GPS assente';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end touch-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Log nautico gps - Impostazioni e medie"
    >
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Top-Right Menu Panel with wide viewport for enlarged nautical chart */}
      <div className="relative z-10 w-full max-w-lg sm:max-w-2xl lg:max-w-3xl h-full overflow-y-auto overscroll-contain bg-zinc-950 border-l border-zinc-800/90 p-3 sm:p-5 space-y-4 text-white">
        {/* Minimal Close Button at Top-Right (No clutter above map) */}
        <div className="flex items-center justify-end pb-1">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-lg border border-zinc-800 bg-black text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors flex items-center justify-center shrink-0 active:scale-95"
            aria-label="Chiudi menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Multi-Point Nautical Chart & GPS Wake Tracker */}
        <NauticalWaypointMap
          boatLat={boatLat}
          boatLon={boatLon}
          boatHeading={telemetry.headingDeg}
          hasRealGpsFix={telemetry.latitude !== null && telemetry.longitude !== null}
          track={telemetry.track}
          onClearTrack={onClearTrack}
          routePoints={routePoints}
          savedRoutes={savedRoutes}
          targetBearingDeg={targetBearingDeg}
          nextLegDistanceNm={nextLegDistanceNm}
          totalRouteDistanceNm={totalRouteDistanceNm}
          speedKnots={telemetry.speedKnots}
          onAddRoutePoint={onAddRoutePoint}
          onUpdateRoutePoint={onUpdateRoutePoint}
          onDeleteRoutePoint={onDeleteRoutePoint}
          onClearActiveRoute={onClearActiveRoute}
          onSaveCurrentRoute={onSaveCurrentRoute}
          onLoadSavedRoute={onLoadSavedRoute}
          onDeleteSavedRoute={onDeleteSavedRoute}
        />

        {/* Reset Button + Duration */}
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono tabular-nums text-xs text-zinc-400">
            Sessione {formatDuration(telemetry.elapsedSeconds)}
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{justReset ? 'Azzerato' : 'Azzera Medie'}</span>
          </button>
        </div>

        {/* Averages, Max & Distance */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-800 bg-black p-4">
          <div>
            <div className="text-xs text-zinc-500">Velocità Media</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-2xl font-bold text-white">
                {telemetry.avgKnots.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500">Kn</span>
            </div>
            <div className="font-mono tabular-nums text-xs text-zinc-500">
              {(telemetry.avgKnots * 1.852).toFixed(1)} km/h
            </div>
          </div>

          <div>
            <div className="text-xs text-zinc-500">Velocità Massima</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-2xl font-bold text-white">
                {telemetry.maxKnots.toFixed(1)}
              </span>
              <span className="text-xs text-zinc-500">Kn</span>
            </div>
            <div className="font-mono tabular-nums text-xs text-zinc-500">
              {(telemetry.maxKnots * 1.852).toFixed(1)} km/h
            </div>
          </div>

          <div className="col-span-2 pt-2 border-t border-zinc-900 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Distanza Percorsa</span>
            <div className="text-right">
              <span className="font-mono tabular-nums text-lg font-bold text-white">
                {telemetry.distanceNm.toFixed(2)} NM
              </span>
              <span className="font-mono tabular-nums text-xs text-zinc-500 ml-2">
                ({(telemetry.distanceNm * 1.852).toFixed(2)} km)
              </span>
            </div>
          </div>
        </div>

        {/* Speed Chart */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Andamento Velocità</span>
            <span className="font-mono text-xs text-zinc-500">Ultimi 60 sec</span>
          </div>
          <SpeedChart samples={telemetry.samples} />
        </div>

        {/* Coordinates & Accuracy */}
        <div className="rounded-xl border border-zinc-800 bg-black p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Coordinate GPS Barca</span>
            <span className="font-mono text-xs text-emerald-400">
              {getGpsStatusText()}
            </span>
          </div>
          {telemetry.latitude !== null && telemetry.longitude !== null ? (
            <div className="font-mono tabular-nums text-xs text-zinc-300 space-y-0.5">
              <div>LAT {formatNauticalCoord(telemetry.latitude, true)}</div>
              <div>LON {formatNauticalCoord(telemetry.longitude, false)}</div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">In attesa del fix satellitare...</div>
          )}
        </div>

        {/* PWA Install Banner */}
        {isInstallable && !isInstalled && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">
                Installa Log Nautico
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                Accesso rapido a schermo intero e uso offline
              </div>
            </div>
            <button
              type="button"
              onClick={install}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-lg bg-sky-400 text-black hover:bg-sky-300 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Installa</span>
            </button>
          </div>
        )}

        {/* iOS Install Instructions */}
        {isIOS && !isInstalled && (
          <div className="rounded-xl border border-zinc-800 bg-black p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">
                Usa a schermo intero su iPhone
              </span>
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                {showIOSGuide ? 'Nascondi' : 'Mostra come'}
              </button>
            </div>
            {showIOSGuide && (
              <div className="text-[11px] text-zinc-400 space-y-1 pt-1 border-t border-zinc-900">
                <p>1. Tocca il tasto Condividi in basso in Safari</p>
                <p>2. Scorri e scegli &quot;Aggiungi alla schermata Home&quot;</p>
                <p>3. Apri l&apos;icona per la visuale nautica a schermo intero</p>
              </div>
            )}
          </div>
        )}

        {/* Wave Filter (Smorzamento Moto Ondoso) */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Smorzamento Moto Ondoso</span>
            <span className="text-[11px] text-zinc-500">Filtro EMA</span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-black rounded-xl border border-zinc-800">
            {[
              { id: WaveFilterLevel.RAW, label: 'Calmo' },
              { id: WaveFilterLevel.MEDIUM, label: 'Normale' },
              { id: WaveFilterLevel.ROUGH, label: 'Mosso' },
            ].map((opt) => {
              const active = waveFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeWaveFilter(opt.id)}
                  className={`min-h-[38px] px-2 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2 pt-2 border-t border-zinc-900">
          {wakeLockSupported && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-black flex items-center justify-between text-xs text-zinc-300 hover:border-zinc-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>Mantieni schermo attivo</span>
              </span>
              <span className="font-mono text-white">
                {wakeLockActive ? 'ON' : 'OFF'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
