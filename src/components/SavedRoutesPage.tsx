import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  BookmarkPlus,
  Compass,
  Play,
  Plus,
  Route,
  Trash2,
  X,
} from 'lucide-react';
import { RouteWaypoint, SavedRoute } from '../types/marine';
import { haversineDistanceMeters, METERS_PER_NAUTICAL_MILE } from '../utils/nautical';
import { unlockMarineAudio } from '../utils/sound';

interface SavedRoutesPageProps {
  isOpen: boolean;
  onClose: () => void;
  savedRoutes: SavedRoute[];
  activeRoutePoints: RouteWaypoint[];
  onSaveCurrentRoute: (name: string) => void;
  onLoadSavedRoute: (route: SavedRoute, reverse?: boolean) => void;
  onDeleteSavedRoute: (id: string) => void;
  onClearActiveRoute: () => void;
}

function computeRouteLengthNm(points: { lat: number; lon: number }[]): number {
  if (points.length < 2) return 0;
  let meters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    meters += haversineDistanceMeters(
      points[i].lat,
      points[i].lon,
      points[i + 1].lat,
      points[i + 1].lon
    );
  }
  return meters / METERS_PER_NAUTICAL_MILE;
}

export const SavedRoutesPage: React.FC<SavedRoutesPageProps> = ({
  isOpen,
  onClose,
  savedRoutes,
  activeRoutePoints,
  onSaveCurrentRoute,
  onLoadSavedRoute,
  onDeleteSavedRoute,
  onClearActiveRoute,
}) => {
  const [routeNameInput, setRouteNameInput] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRoutePoints.length === 0) return;
    unlockMarineAudio();
    onSaveCurrentRoute(routeNameInput);
    setRouteNameInput('');
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  };

  const activeRouteLength = computeRouteLengthNm(activeRoutePoints);

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rotte salvate e programmate"
      className="fixed inset-0 z-[9999] flex flex-col bg-black text-white touch-auto overflow-hidden animate-in fade-in duration-150"
    >
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/90 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-yellow-400" />
          <span>Torna alla carta</span>
        </button>

        <div className="flex items-center gap-1.5 font-semibold text-sm text-white">
          <Route className="w-4 h-4 text-yellow-400" />
          <span>Rotte Salvate ({savedRoutes.length})</span>
        </div>

        <div className="flex items-center gap-1.5">
          {activeRoutePoints.length > 0 && (
            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                onClearActiveRoute();
              }}
              title="Elimina rotta attiva"
              aria-label="Elimina rotta attiva"
              className="min-h-[36px] px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Elimina rotta</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi pagina rotte"
            className="min-h-[40px] min-w-[40px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 max-w-xl mx-auto w-full">
        {/* Active Route Save Box (if a route is drawn on the chart) */}
        {activeRoutePoints.length > 0 && (
          <div className="relative rounded-xl border border-yellow-400/50 bg-zinc-950 p-4 space-y-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                  <Route className="w-4 h-4" />
                  <span>Rotta Attiva sulla Carta</span>
                </span>
                <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                  {activeRoutePoints.length} {activeRoutePoints.length === 1 ? 'punto' : 'punti'} · {activeRouteLength.toFixed(2)} NM
                </span>
              </div>

              {/* Trash icon in top-right corner of routes panel as requested */}
              <button
                type="button"
                onClick={() => {
                  unlockMarineAudio();
                  onClearActiveRoute();
                }}
                title="Elimina rotta attiva"
                aria-label="Elimina rotta attiva"
                className="min-h-[32px] px-2.5 rounded-lg border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Elimina rotta</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="flex items-center gap-2 pt-1 border-t border-zinc-900">
              <input
                type="text"
                value={routeNameInput}
                onChange={(e) => setRouteNameInput(e.target.value)}
                placeholder={`Nome rotta (es. Cala Corsara - Spargi)...`}
                maxLength={40}
                className="flex-1 min-w-0 min-h-[40px] px-3 rounded-lg border border-zinc-800 bg-black text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-400"
              />
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-lg bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-300 transition-colors flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>{justSaved ? 'Salvata!' : 'Salva'}</span>
              </button>
            </form>
          </div>
        )}

        {/* List of Saved Routes */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-400 px-1">
            Libreria Rotte ({savedRoutes.length})
          </div>

          {savedRoutes.length > 0 ? (
            <div className="space-y-2.5">
              {savedRoutes.map((route) => {
                const len = computeRouteLengthNm(route.points);
                const dateStr = new Date(route.createdAt).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div
                    key={route.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-2.5 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          {route.name}
                        </h3>
                        <p className="text-xs font-mono text-zinc-400 mt-0.5">
                          {route.points.length} punti · {len.toFixed(2)} NM · Creata il {dateStr}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          unlockMarineAudio();
                          onDeleteSavedRoute(route.id);
                        }}
                        aria-label={`Elimina ${route.name}`}
                        className="min-h-[32px] min-w-[32px] rounded-lg border border-zinc-800 bg-black flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                      <button
                        type="button"
                        onClick={() => {
                          unlockMarineAudio();
                          onLoadSavedRoute(route, false);
                          onClose();
                        }}
                        className="flex-1 min-h-[38px] px-3 rounded-lg bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-300 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Carica e Usa sulla Carta</span>
                      </button>

                      {route.points.length >= 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            unlockMarineAudio();
                            onLoadSavedRoute(route, true);
                            onClose();
                          }}
                          title="Carica rotta al contrario (rientro)"
                          className="min-h-[38px] px-3 rounded-lg border border-zinc-800 bg-black text-xs font-semibold text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-400" />
                          <span>Inverti (Rientro)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-8 text-center space-y-3">
              <Compass className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-white">Nessuna rotta salvata</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Tocca i punti sulla carta nautica per tracciare il percorso della tua navigazione. Poi torna in questa pagina per salvarla e riusarla tutte le volte che vuoi.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-[38px] px-4 rounded-lg bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
              >
                Torna alla carta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
};
