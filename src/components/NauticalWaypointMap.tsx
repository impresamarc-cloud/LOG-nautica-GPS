import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import {
  BookmarkPlus,
  Check,
  Compass,
  Crosshair,
  Layers,
  Move,
  Navigation,
  Play,
  Plus,
  Route,
  Trash2,
  X,
} from 'lucide-react';
import {
  RouteWaypoint,
  SavedRoute,
  TrackPoint,
  WaypointTarget,
} from '../types/marine';
import {
  computeDestinationPoint,
  formatHeading3Digits,
  formatNauticalCoord,
  haversineDistanceMeters,
  METERS_PER_NAUTICAL_MILE,
} from '../utils/nautical';
import {
  createNauticalSymbolIcon,
  declutterNauticalFeatures,
  fetchHydrographicFeatures,
  HydrographicDataset,
  NauticalFilterSettings,
  NauticalPointFeature,
} from '../utils/nauticalChartFeatures';
import { unlockMarineAudio } from '../utils/sound';
import { SavedRoutesPage } from './SavedRoutesPage';

interface NauticalWaypointMapProps {
  boatLat: number;
  boatLon: number;
  boatHeading: number | null;
  hasRealGpsFix: boolean;
  track: TrackPoint[];
  onClearTrack: () => void;
  routePoints: RouteWaypoint[];
  savedRoutes: SavedRoute[];
  targetBearingDeg: number | null;
  nextLegDistanceNm: number | null;
  totalRouteDistanceNm: number | null;
  speedKnots: number;
  onAddRoutePoint: (pt: WaypointTarget) => void;
  onUpdateRoutePoint: (id: string, pt: WaypointTarget) => void;
  onDeleteRoutePoint: (id: string) => void;
  onClearActiveRoute: () => void;
  onSaveCurrentRoute: (name: string) => void;
  onLoadSavedRoute: (route: SavedRoute, reverse?: boolean) => void;
  onDeleteSavedRoute: (id: string) => void;
}

const OSM_STANDARD_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OPENSEAMAP_SEAMARK_URL =
  'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
const EMODNET_BATHYMETRY_WMS_URL = 'https://ows.emodnet-bathymetry.eu/wms';

function computeRouteLengthNm(points: WaypointTarget[]): number {
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

/**
 * Calculates the map center coordinate such that the boat coordinate is positioned
 * at horizontal center (50%) and 1/4 (25%) from the bottom of the map viewport.
 * This maximizes forward visibility in front of the vessel's bow.
 */
function getMapCenterForBoatAtOffset(
  map: L.Map,
  lat: number,
  lon: number,
  zoom?: number
): L.LatLng {
  const currentZoom = zoom ?? map.getZoom();
  const boatPoint = map.project([lat, lon], currentZoom);
  const size = map.getSize();
  const height = size.y > 50 ? size.y : 560;
  const targetCenterPoint = L.point(boatPoint.x, boatPoint.y - height * 0.25);
  return map.unproject(targetCenterPoint, currentZoom);
}

function createBoatIcon(): L.DivIcon {
  return L.divIcon({
    className: 'nautical-div-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `
      <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;transform:rotate(0deg);">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" fill="#000000" fill-opacity="0.8" stroke="#FFFFFF" stroke-width="2"/>
          <polygon points="16,5 23,24 16,20 9,24" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.4"/>
        </svg>
      </div>
    `,
  });
}

/**
 * Route waypoint marker icon:
 * - High-contrast Raymarine style yellow/black numbered diamond
 * - Direct draggable handle with touch-action: none
 */
function createRoutePointIcon(indexOneBased: number, isFirstActive: boolean): L.DivIcon {
  const fill = isFirstActive ? '#FACC15' : '#18181B';
  const stroke = '#FACC15';
  const textCol = isFirstActive ? '#000000' : '#FACC15';

  return L.divIcon({
    className: 'nautical-div-icon route-waypoint-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div class="wp-marker-inner" style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;touch-action:none;">
        <!-- Draggable Central Waypoint Symbol -->
        <div class="wp-symbol" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;transition:transform 0.15s ease;cursor:grab;">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="17" cy="17" r="14.5" fill="#000000" fill-opacity="0.8" stroke="${stroke}" stroke-width="${isFirstActive ? '2.4' : '1.6'}"/>
            <polygon class="wp-diamond" points="17,5 29,17 17,29 5,17" fill="${fill}" stroke="${isFirstActive ? '#000000' : stroke}" stroke-width="1.4"/>
            <text class="wp-num-text" x="17" y="21.5" text-anchor="middle" fill="${textCol}" font-size="11.5" font-weight="800" font-family="Chakra Petch, sans-serif">${indexOneBased}</text>
          </svg>
        </div>

        <!-- Solo una X per eliminare il punto -->
        <button type="button" class="wp-delete-btn" title="Elimina punto" aria-label="Elimina punto">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `,
  });
}

export const NauticalWaypointMap: React.FC<NauticalWaypointMapProps> = ({
  boatLat,
  boatLon,
  boatHeading,
  hasRealGpsFix,
  track,
  onClearTrack,
  routePoints,
  savedRoutes,
  targetBearingDeg,
  nextLegDistanceNm,
  totalRouteDistanceNm,
  speedKnots,
  onAddRoutePoint,
  onUpdateRoutePoint,
  onDeleteRoutePoint,
  onClearActiveRoute,
  onSaveCurrentRoute,
  onLoadSavedRoute,
  onDeleteSavedRoute,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const boatMarkerRef = useRef<L.Marker | null>(null);

  // Layer groups for GPS wake trail, heading line, multi-point route, contours, and hydrography
  const trackLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const headingLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const contoursLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const hydroLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Persistent polylines and marker dictionary for uninterrupted dragging during navigation
  const activeLegPolylineRef = useRef<L.Polyline | null>(null);
  const subsequentHaloPolylineRef = useRef<L.Polyline | null>(null);
  const subsequentLegsPolylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const draggingWpIdRef = useRef<string | null>(null);
  const wasJustDraggedRef = useRef<boolean>(false);

  const datasetRef = useRef<HydrographicDataset>({
    points: [],
    lines: [],
    updatedAtIso: null,
  });

  // Fresh mutable refs for callbacks and boat coordinates
  const boatLatRef = useRef(boatLat);
  boatLatRef.current = boatLat;
  const boatLonRef = useRef(boatLon);
  boatLonRef.current = boatLon;
  const routePointsRef = useRef(routePoints);
  routePointsRef.current = routePoints;

  const onAddRoutePointRef = useRef(onAddRoutePoint);
  onAddRoutePointRef.current = onAddRoutePoint;
  const onUpdateRoutePointRef = useRef(onUpdateRoutePoint);
  onUpdateRoutePointRef.current = onUpdateRoutePoint;
  const onDeleteRoutePointRef = useRef(onDeleteRoutePoint);
  onDeleteRoutePointRef.current = onDeleteRoutePoint;

  // Selected waypoint state: allows BOTH dragging and tap-on-chart repositioning!
  const [selectedWpId, setSelectedWpId] = useState<string | null>(null);
  const selectedWpIdRef = useRef<string | null>(null);
  selectedWpIdRef.current = selectedWpId;

  // Granular nautical layer filters (Bricole toggleable separately!)
  const [showBricole, setShowBricole] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [showBuoys, setShowBuoys] = useState<boolean>(true);
  const [showLights, setShowLights] = useState<boolean>(true);
  const [showContours, setShowContours] = useState<boolean>(true);
  const [showTrack, setShowTrack] = useState<boolean>(true);
  const [showHeadingLine, setShowHeadingLine] = useState<boolean>(true);

  // Auto-follow: keeps boat centered while map scrolls and rotates underneath
  const [isAutoFollow, setIsAutoFollow] = useState<boolean>(true);
  const isAutoFollowRef = useRef<boolean>(true);
  isAutoFollowRef.current = isAutoFollow;

  const outerViewportRef = useRef<HTMLDivElement | null>(null);

  // Map rotates so that boat is permanently pointing straight UP (Head-Up marine mode)
  const mapRotationDeg = useMemo(() => {
    if (boatHeading !== null && Number.isFinite(boatHeading)) {
      return -boatHeading;
    }
    return 0;
  }, [boatHeading]);
  const mapRotationDegRef = useRef<number>(0);
  mapRotationDegRef.current = mapRotationDeg;

  // Dedicated Modals
  const [showLayersModal, setShowLayersModal] = useState<boolean>(false);
  const [showSavedRoutesModal, setShowSavedRoutesModal] = useState<boolean>(false);

  const [selectedFeature, setSelectedFeature] =
    useState<NauticalPointFeature | null>(null);

  const showHazardsRef = useRef(showHazards);
  showHazardsRef.current = showHazards;
  const showBuoysRef = useRef(showBuoys);
  showBuoysRef.current = showBuoys;
  const showBricoleRef = useRef(showBricole);
  showBricoleRef.current = showBricole;
  const showLightsRef = useRef(showLights);
  showLightsRef.current = showLights;

  // Live update the connected route polylines in real-time as points are dragged or moved
  const updateRoutePolylines = useCallback((pts: WaypointTarget[]) => {
    const routeGroup = routeLayerGroupRef.current;
    if (!routeGroup) return;

    if (pts.length === 0) {
      if (activeLegPolylineRef.current) {
        activeLegPolylineRef.current.remove();
        activeLegPolylineRef.current = null;
      }
      if (subsequentLegsPolylineRef.current) {
        subsequentLegsPolylineRef.current.remove();
        subsequentLegsPolylineRef.current = null;
      }
      if (subsequentHaloPolylineRef.current) {
        subsequentHaloPolylineRef.current.remove();
        subsequentHaloPolylineRef.current = null;
      }
      return;
    }

    // 1. Active Leg: boat -> WP 1
    const activeLegCoords: L.LatLngExpression[] = [
      [boatLatRef.current, boatLonRef.current],
      [pts[0].lat, pts[0].lon],
    ];

    if (!activeLegPolylineRef.current) {
      activeLegPolylineRef.current = L.polyline(activeLegCoords, {
        color: '#FACC15',
        weight: 3.6,
        dashArray: '8, 6',
        opacity: 0.96,
        interactive: false,
      }).addTo(routeGroup);
    } else {
      activeLegPolylineRef.current.setLatLngs(activeLegCoords);
    }

    // 2. Subsequent legs: WP 1 -> WP 2 -> ...
    if (pts.length >= 2) {
      const subsequentCoords: L.LatLngExpression[] = pts.map((p) => [p.lat, p.lon]);

      if (!subsequentHaloPolylineRef.current) {
        subsequentHaloPolylineRef.current = L.polyline(subsequentCoords, {
          color: '#000000',
          weight: 4.8,
          opacity: 0.42,
          lineJoin: 'round',
          interactive: false,
        }).addTo(routeGroup);
      } else {
        subsequentHaloPolylineRef.current.setLatLngs(subsequentCoords);
      }

      if (!subsequentLegsPolylineRef.current) {
        subsequentLegsPolylineRef.current = L.polyline(subsequentCoords, {
          color: '#FACC15',
          weight: 2.6,
          opacity: 0.88,
          lineJoin: 'round',
          interactive: false,
        }).addTo(routeGroup);
      } else {
        subsequentLegsPolylineRef.current.setLatLngs(subsequentCoords);
      }
    } else {
      if (subsequentLegsPolylineRef.current) {
        subsequentLegsPolylineRef.current.remove();
        subsequentLegsPolylineRef.current = null;
      }
      if (subsequentHaloPolylineRef.current) {
        subsequentHaloPolylineRef.current.remove();
        subsequentHaloPolylineRef.current = null;
      }
    }
  }, []);

  const renderHydrographicLayer = useCallback(() => {
    const map = mapRef.current;
    const group = hydroLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const zoom = map.getZoom();

    if (zoom < 10) {
      return;
    }

    const dataset = datasetRef.current;

    if (showHazardsRef.current && zoom >= 11) {
      for (const line of dataset.lines) {
        for (const seg of line.coordinates) {
          if (seg.length < 2) continue;
          L.polyline(seg, {
            color: line.kind === 'PIPELINE' ? '#EA580C' : '#C026D3',
            weight: 1.5,
            opacity: 0.58,
            dashArray: line.kind === 'PIPELINE' ? '6, 4' : '4, 5',
            interactive: false,
          }).addTo(group);
        }
      }
    }

    const filterSettings: NauticalFilterSettings = {
      showHazards: showHazardsRef.current,
      showBuoys: showBuoysRef.current,
      showBricole: showBricoleRef.current,
      showLights: showLightsRef.current,
    };

    const decluttered = declutterNauticalFeatures(
      dataset.points,
      map,
      filterSettings
    );

    for (const item of decluttered) {
      const marker = L.marker([item.lat, item.lon], {
        icon: createNauticalSymbolIcon(item, zoom),
        keyboard: false,
      });

      const tooltipHtml = item.subtitle
        ? `<strong>${item.title}</strong><br/><span style="color:#a1a1aa">${item.subtitle}</span>`
        : `<strong>${item.title}</strong>`;

      marker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -8],
        className: 'nautical-chart-tooltip',
      });

      marker.on('click', (ev: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(ev);
        setSelectedFeature(item);
      });

      marker.addTo(group);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const initialCenter: L.LatLngExpression =
      routePoints.length > 0
        ? [routePoints[0].lat, routePoints[0].lon]
        : [boatLat, boatLon];

    const map = L.map(el, {
      center: initialCenter,
      zoom: 13,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
    });
    if (map.zoomControl) {
      map.zoomControl.remove();
    }

    // 1. Daytime Base Chart (OpenStreetMap)
    L.tileLayer(OSM_STANDARD_URL, {
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // 2. Official Bathymetric Depth Contours (EMODnet)
    const contoursLayer = L.tileLayer.wms(EMODNET_BATHYMETRY_WMS_URL, {
      layers: 'emodnet:contours',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.45,
      maxZoom: 19,
      attribution: '&copy; EMODnet',
    }).addTo(map);
    contoursLayerRef.current = contoursLayer;

    // 3. OpenSeaMap Official Seamark Layer
    L.tileLayer(OPENSEAMAP_SEAMARK_URL, {
      maxNativeZoom: 18,
      maxZoom: 19,
      opacity: 0.92,
      attribution: '&copy; OpenSeaMap',
    }).addTo(map);

    // 4. Hydrographic Vector Layer (Scogli, Ostacoli, Boe, Bricole, Fari)
    const hydroGroup = L.layerGroup().addTo(map);
    hydroLayerGroupRef.current = hydroGroup;

    // 5. Executed GPS Boat Track Layer (Percorso eseguito)
    const trackGroup = L.layerGroup().addTo(map);
    trackLayerGroupRef.current = trackGroup;

    // 6. Infinite Heading Line Layer (Linea di prua infinita / Direzione di rotta)
    const headingGroup = L.layerGroup().addTo(map);
    headingLayerGroupRef.current = headingGroup;

    // 7. Connected Multi-Point Route Layer
    const routeGroup = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = routeGroup;

    // User drag on chart pauses auto-follow mode so they can explore freely
    map.on('dragstart', () => {
      isAutoFollowRef.current = false;
      setIsAutoFollow(false);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      unlockMarineAudio();
      setSelectedFeature(null);

      // If a drag just finished, ignore the synthetic map click
      if (wasJustDraggedRef.current) return;

      let clickLatLng = e.latlng;
      const outer = outerViewportRef.current;
      const currentRotation = mapRotationDegRef.current;

      if (outer && currentRotation !== 0) {
        const rect = outer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const orig = e.originalEvent;
        const clientX = 'clientX' in orig ? (orig as MouseEvent).clientX : (orig as TouchEvent).touches?.[0]?.clientX ?? cx;
        const clientY = 'clientY' in orig ? (orig as MouseEvent).clientY : (orig as TouchEvent).touches?.[0]?.clientY ?? cy;
        const dx = clientX - cx;
        const dy = clientY - cy;
        // Map is rotated by currentRotation, so inverse rotation is -currentRotation
        const rad = (currentRotation * Math.PI) / 180;
        const unrotatedDx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const unrotatedDy = dx * Math.sin(-rad) + dy * Math.cos(-rad);
        const centerPoint = map.getSize().divideBy(2);
        const correctedPoint = L.point(centerPoint.x + unrotatedDx, centerPoint.y + unrotatedDy);
        clickLatLng = map.containerPointToLatLng(correctedPoint);
      }

      // If a waypoint is selected for repositioning, move it here!
      if (selectedWpIdRef.current !== null) {
        const idToMove = selectedWpIdRef.current;
        onUpdateRoutePointRef.current(idToMove, {
          lat: clickLatLng.lat,
          lon: clickLatLng.lng,
        });
        setSelectedWpId(null);
        return;
      }

      // Otherwise, add a new point along the route
      onAddRoutePointRef.current({
        lat: clickLatLng.lat,
        lon: clickLatLng.lng,
      });
    });

    mapRef.current = map;

    let debounceTimer: number | null = null;
    let activeAbort: AbortController | null = null;

    const refreshViewportHydrography = () => {
      const z = map.getZoom();
      renderHydrographicLayer();

      if (z < 10) {
        return;
      }

      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }

      debounceTimer = window.setTimeout(async () => {
        if (!mapRef.current) return;
        const b = map.getBounds();
        const center = map.getCenter();
        const maxDelta = 0.28;
        const south = Math.max(b.getSouth(), center.lat - maxDelta);
        const north = Math.min(b.getNorth(), center.lat + maxDelta);
        const west = Math.max(b.getWest(), center.lng - maxDelta);
        const east = Math.min(b.getEast(), center.lng + maxDelta);

        if (activeAbort) {
          activeAbort.abort();
        }
        const controller = new AbortController();
        activeAbort = controller;

        try {
          const data = await fetchHydrographicFeatures(
            south,
            west,
            north,
            east,
            controller.signal
          );
          if (!controller.signal.aborted && mapRef.current) {
            datasetRef.current = data;
            renderHydrographicLayer();
          }
        } catch {
          // Ignore aborted fetch
        }
      }, 240);
    };

    map.on('moveend', refreshViewportHydrography);
    map.on('zoomend', refreshViewportHydrography);

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);

    const t1 = window.setTimeout(() => {
      map.invalidateSize();
      if (isAutoFollowRef.current) {
        const initialCenter = getMapCenterForBoatAtOffset(
          map,
          boatLatRef.current,
          boatLonRef.current,
          13
        );
        map.setView(initialCenter, 13, { animate: false });
      }
      refreshViewportHydrography();
    }, 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 280);

    return () => {
      ro.disconnect();
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      if (activeAbort) activeAbort.abort();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      mapRef.current = null;
      boatMarkerRef.current = null;
      trackLayerGroupRef.current = null;
      headingLayerGroupRef.current = null;
      routeLayerGroupRef.current = null;
      contoursLayerRef.current = null;
      hydroLayerGroupRef.current = null;
      activeLegPolylineRef.current = null;
      subsequentHaloPolylineRef.current = null;
      subsequentLegsPolylineRef.current = null;
      routeMarkersMapRef.current.clear();
    };
  }, [renderHydrographicLayer]);

  useEffect(() => {
    renderHydrographicLayer();
  }, [showHazards, showBuoys, showBricole, showLights, renderHydrographicLayer]);

  useEffect(() => {
    const map = mapRef.current;
    const contours = contoursLayerRef.current;
    if (!map || !contours) return;

    if (showContours) {
      if (!map.hasLayer(contours)) {
        contours.addTo(map);
      }
    } else if (map.hasLayer(contours)) {
      map.removeLayer(contours);
    }
  }, [showContours]);

  // Render Live Boat Icon + Infinite Heading Line + Executed GPS Track + Auto-Follow Lock
  useEffect(() => {
    const map = mapRef.current;
    const trackGroup = trackLayerGroupRef.current;
    const headingGroup = headingLayerGroupRef.current;
    if (!map || !trackGroup) return;

    // 1. Auto-Follow Camera Lock: Keeps boat centered as map rotates and glides underneath
    if (isAutoFollowRef.current) {
      map.setView([boatLat, boatLon], map.getZoom(), { animate: false });
    }

    const boatLatLng: L.LatLngExpression = [boatLat, boatLon];

    // 2. Boat Marker permanently pointing straight up (North / 0°)
    if (!boatMarkerRef.current) {
      boatMarkerRef.current = L.marker(boatLatLng, {
        icon: createBoatIcon(),
        interactive: false,
        zIndexOffset: 950,
      }).addTo(map);
    } else {
      boatMarkerRef.current.setLatLng(boatLatLng);
      boatMarkerRef.current.setIcon(createBoatIcon());
    }

    // 3. Infinite Heading Line from bow showing current course direction
    if (headingGroup) {
      headingGroup.clearLayers();
      if (
        showHeadingLine &&
        boatHeading !== null &&
        Number.isFinite(boatHeading)
      ) {
        // Project 200 nautical miles ahead along current true heading
        const dest = computeDestinationPoint(
          boatLat,
          boatLon,
          boatHeading,
          200 * METERS_PER_NAUTICAL_MILE
        );

        // Dark contrast halo line so it stands out against any map background
        L.polyline(
          [
            [boatLat, boatLon],
            [dest.lat, dest.lon],
          ],
          {
            color: '#000000',
            weight: 4.8,
            opacity: 0.6,
            interactive: false,
          }
        ).addTo(headingGroup);

        // Crisp Raymarine vibrant orange heading line
        L.polyline(
          [
            [boatLat, boatLon],
            [dest.lat, dest.lon],
          ],
          {
            color: '#FF6B00',
            weight: 2.4,
            opacity: 0.95,
            interactive: false,
          }
        ).addTo(headingGroup);
      }
    }

    // 4. Executed GPS Track
    trackGroup.clearLayers();
    if (showTrack && track.length > 0) {
      const coords: L.LatLngExpression[] = track.map((pt) => [pt.lat, pt.lon]);
      // Connect last recorded track fix smoothly up to live boat stern
      coords.push([boatLat, boatLon]);

      if (coords.length >= 2) {
        // Subtle dark contrast halo so cyan wake stands out on light blue water
        L.polyline(coords, {
          color: '#082F49',
          weight: 5.2,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(trackGroup);

        // Crisp cyan GPS wake trail
        L.polyline(coords, {
          color: '#38BDF8',
          weight: 2.8,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(trackGroup);

        // Track origin dot
        L.circleMarker(coords[0], {
          radius: 3.5,
          color: '#FFFFFF',
          weight: 1.4,
          fillColor: '#0284C7',
          fillOpacity: 1,
          interactive: false,
        }).addTo(trackGroup);
      }
    }
  }, [boatLat, boatLon, boatHeading, track, showTrack, showHeadingLine]);

  // Dedicated lightweight update of active boat-to-WP1 line whenever boatLat/boatLon changes
  // This NEVER destroys, clears, or resets waypoint markers during active navigation!
  useEffect(() => {
    if (activeLegPolylineRef.current && routePointsRef.current.length > 0) {
      const wp1 = routePointsRef.current[0];
      activeLegPolylineRef.current.setLatLngs([
        [boatLat, boatLon],
        [wp1.lat, wp1.lon],
      ]);
    }
  }, [boatLat, boatLon]);

  // Sync selected visual state on marker DOM elements without rebuilding Leaflet markers
  useEffect(() => {
    routeMarkersMapRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      if (!el) return;
      if (id === selectedWpId) {
        el.classList.add('is-selected');
      } else {
        el.classList.remove('is-selected');
      }
    });
  }, [selectedWpId]);

  // Waypoint Markers synchronization:
  // Keeps existing markers alive with intact Leaflet Draggable handlers for 100% fluid dragging!
  useEffect(() => {
    const routeGroup = routeLayerGroupRef.current;
    const map = mapRef.current;
    if (!routeGroup || !map) return;

    // Keep polylines in sync
    updateRoutePolylines(routePoints);

    const existingMap = routeMarkersMapRef.current;
    const currentIds = new Set(routePoints.map((p) => p.id));

    // 1. Remove markers no longer in route
    for (const [id, marker] of existingMap.entries()) {
      if (!currentIds.has(id)) {
        marker.remove();
        existingMap.delete(id);
      }
    }

    const wireDeleteListeners = (m: L.Marker, targetId: string) => {
      const el = m.getElement();
      if (!el) return;

      const delBtn = el.querySelector('.wp-delete-btn');
      if (delBtn && !(delBtn as unknown as { _hasDelWired?: boolean })._hasDelWired) {
        (delBtn as unknown as { _hasDelWired?: boolean })._hasDelWired = true;
        L.DomEvent.disableClickPropagation(delBtn as HTMLElement);
        L.DomEvent.disableScrollPropagation(delBtn as HTMLElement);

        const handleDelete = (e: Event) => {
          e.stopPropagation();
          e.preventDefault();
          unlockMarineAudio();
          setSelectedWpId(null);
          onDeleteRoutePointRef.current(targetId);
        };

        delBtn.addEventListener('click', handleDelete);
        delBtn.addEventListener('touchend', handleDelete);
      }
    };

    // 2. Add or update markers in place WITHOUT reconstructing DOM on every drag or tick
    routePoints.forEach((pt, idx) => {
      const isFirst = idx === 0;
      let marker = existingMap.get(pt.id);

      if (!marker) {
        // Create new marker instance
        marker = L.marker([pt.lat, pt.lon], {
          icon: createRoutePointIcon(idx + 1, isFirst),
          draggable: true,
          autoPan: true,
          zIndexOffset: isFirst ? 1100 : 900,
        });

        marker.on('dragstart', () => {
          draggingWpIdRef.current = pt.id;
          marker?.getElement()?.classList.add('is-dragging');
        });

        marker.on('drag', () => {
          const currentPos = marker?.getLatLng();
          if (!currentPos) return;

          // Re-route polylines in real time as the marker glides across the sea
          const livePoints = routePointsRef.current.map((p) =>
            p.id === pt.id ? { lat: currentPos.lat, lon: currentPos.lng } : { lat: p.lat, lon: p.lon }
          );
          updateRoutePolylines(livePoints);
        });

        marker.on('dragend', () => {
          marker?.getElement()?.classList.remove('is-dragging');
          unlockMarineAudio();
          const finalPos = marker?.getLatLng();
          if (finalPos) {
            onUpdateRoutePointRef.current(pt.id, { lat: finalPos.lat, lon: finalPos.lng });
          }
          wasJustDraggedRef.current = true;
          setTimeout(() => {
            wasJustDraggedRef.current = false;
            draggingWpIdRef.current = null;
          }, 150);
        });

        // Double click immediately deletes point
        marker.on('dblclick', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          unlockMarineAudio();
          setSelectedWpId(null);
          onDeleteRoutePointRef.current(pt.id);
        });

        // Quick click toggles selection, revealing the prominent red 'X' delete button
        marker.on('click', (ev: L.LeafletMouseEvent) => {
          if (wasJustDraggedRef.current) return;
          L.DomEvent.stopPropagation(ev);
          unlockMarineAudio();
          setSelectedWpId((prev) => (prev === pt.id ? null : pt.id));
        });

        marker.addTo(routeGroup);
        existingMap.set(pt.id, marker);
        wireDeleteListeners(marker, pt.id);
      } else {
        // Marker already exists: update its coordinates only if not actively being dragged
        if (draggingWpIdRef.current !== pt.id) {
          marker.setLatLng([pt.lat, pt.lon]);
        }

        // Update sequence number and styling directly in SVG without destroying DOM or Draggable!
        const el = marker.getElement();
        if (el) {
          const textEl = el.querySelector('.wp-num-text');
          if (textEl && textEl.textContent !== String(idx + 1)) {
            textEl.textContent = String(idx + 1);
          }
          const diamondEl = el.querySelector('.wp-diamond');
          if (diamondEl) {
            diamondEl.setAttribute('fill', isFirst ? '#FACC15' : '#18181B');
            diamondEl.setAttribute('stroke', isFirst ? '#000000' : '#FACC15');
          }
          if (textEl) {
            textEl.setAttribute('fill', isFirst ? '#000000' : '#FACC15');
          }
        }
        wireDeleteListeners(marker, pt.id);
        marker.setZIndexOffset(isFirst ? 1100 : 900);
      }
    });
  }, [routePoints, updateRoutePolylines]);

  const handleCenterBoat = () => {
    const map = mapRef.current;
    if (!map) return;
    unlockMarineAudio();
    isAutoFollowRef.current = true;
    setIsAutoFollow(true);
    map.flyTo([boatLat, boatLon], Math.max(map.getZoom(), 13), { duration: 0.35 });
  };

  const handleLoadRouteAndFit = (saved: SavedRoute, reverse = false) => {
    unlockMarineAudio();
    setSelectedWpId(null);
    isAutoFollowRef.current = false;
    setIsAutoFollow(false);
    onLoadSavedRoute(saved, reverse);
    if (mapRef.current && saved.points.length > 0) {
      const bounds = L.latLngBounds(
        saved.points.map((p) => [p.lat, p.lon] as [number, number])
      );
      mapRef.current.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
    }
  };

  const selectedWpIndex = useMemo(() => {
    if (!selectedWpId) return null;
    const foundIdx = routePoints.findIndex((p) => p.id === selectedWpId);
    return foundIdx >= 0 ? foundIdx + 1 : null;
  }, [selectedWpId, routePoints]);

  const selectedWpPoint = useMemo(() => {
    if (!selectedWpId) return null;
    return routePoints.find((p) => p.id === selectedWpId) || null;
  }, [selectedWpId, routePoints]);

  const etaText = useMemo(() => {
    if (totalRouteDistanceNm === null || speedKnots < 0.4) return '--';
    const totalMins = Math.round((totalRouteDistanceNm / speedKnots) * 60);
    if (totalMins < 60) return `${totalMins} min`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  }, [totalRouteDistanceNm, speedKnots]);

  return (
    <div className="shrink-0 rounded-xl border border-zinc-800 bg-black p-3 space-y-2.5">
      {/* Map Viewport - enlarged surface area directly at the top, without header or explanation above */}
      <div
        ref={outerViewportRef}
        className="relative w-full h-[540px] sm:h-[600px] min-h-[500px] sm:min-h-[560px] rounded-lg overflow-hidden border border-zinc-700 bg-[#AAD3DF]"
      >
        {/* Rotating Map Canvas - 180% width/height centered at 50% 50% so map smoothly turns under the boat */}
        <div
          className="absolute inset-[-40%] pointer-events-auto"
          style={{
            transform: `rotate(${mapRotationDeg}deg)`,
            transformOrigin: '50% 50%',
            transition: 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          <div ref={containerRef} className="w-full h-full min-h-[500px] sm:min-h-[560px]" />
        </div>

        {/* Dynamic North Compass Rose - Indicates True North on the rotating chart */}
        <div className="absolute top-2.5 left-2.5 z-[450] pointer-events-auto">
          <div
            className="w-9 h-9 rounded-full border border-zinc-700 bg-zinc-950/90 shadow-md flex items-center justify-center backdrop-blur-xs transition-transform duration-200"
            style={{ transform: `rotate(${mapRotationDeg}deg)` }}
            title="Bussola di carta - Indica il Nord geografico"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="12,2 15.5,12 12,9.5 8.5,12" fill="#EF4444" stroke="#FFFFFF" strokeWidth="0.8"/>
              <polygon points="12,22 15.5,12 12,14.5 8.5,12" fill="#E4E4E7" stroke="#71717A" strokeWidth="0.8"/>
              <circle cx="12" cy="12" r="1.8" fill="#FFFFFF"/>
            </svg>
            <span className="absolute -top-1 font-mono text-[8px] font-black text-red-400">N</span>
          </div>
        </div>

        {/* Square map action controls on the right (Centra + Livelli/Legenda under it) - compact w-8 h-8 */}
        <div className="absolute top-2.5 right-2.5 z-[450] flex flex-col gap-1.5 pointer-events-auto">
          {/* Centra barca - Compact square icon-only button on the right */}
          <button
            type="button"
            onClick={handleCenterBoat}
            title={isAutoFollow ? 'Mappa centrata sulla barca (Auto-follow attivo)' : 'Centra mappa sulla barca'}
            aria-label={isAutoFollow ? 'Centrato sulla barca' : 'Centra sulla barca'}
            className={`w-8 h-8 rounded-md border backdrop-blur-xs flex items-center justify-center transition-all shadow-md active:scale-95 ${
              isAutoFollow
                ? 'border-yellow-400 bg-zinc-950 text-yellow-300 ring-1.5 ring-yellow-400/50 shadow-yellow-400/20'
                : 'border-zinc-700 bg-zinc-950/90 text-zinc-300 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Crosshair className={`w-4 h-4 ${isAutoFollow ? 'text-yellow-400' : 'text-zinc-300'}`} />
          </button>

          {/* Livelli e Legenda - Compact square icon-only button on the right, under Centra */}
          <button
            type="button"
            onClick={() => {
              unlockMarineAudio();
              setShowLayersModal((v) => !v);
            }}
            title="Livelli carta e legenda nautica"
            aria-label="Apri pannello livelli e legenda"
            className={`w-8 h-8 rounded-md border backdrop-blur-xs flex items-center justify-center transition-all shadow-md active:scale-95 ${
              showLayersModal
                ? 'border-sky-400 bg-zinc-950 text-sky-300 ring-1.5 ring-sky-400/50 shadow-sky-400/20'
                : 'border-zinc-700 bg-zinc-950/90 text-sky-400 hover:text-sky-300 hover:bg-zinc-900'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Waypoint Action Bar */}
      {selectedWpPoint && selectedWpIndex !== null && (
        <div className="rounded-xl border-2 border-yellow-400/80 bg-zinc-950 p-3 space-y-2 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-yellow-400 text-black font-extrabold text-xs flex items-center justify-center font-mono">
                {selectedWpIndex}
              </span>
              <div>
                <span className="text-xs font-bold text-white block">
                  Punto {selectedWpIndex} selezionato
                </span>
                <span className="text-[11px] text-yellow-300 flex items-center gap-1">
                  <Move className="w-3 h-3 animate-pulse" />
                  <span>Trascinalo o tocca sulla carta per spostarlo</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedWpId(null)}
              className="min-h-[32px] px-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-medium text-white hover:bg-zinc-800 transition-colors flex items-center gap-1 shrink-0"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fatto</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800 text-xs">
            <div className="font-mono tabular-nums text-[11px] text-zinc-400">
              {formatNauticalCoord(selectedWpPoint.lat, true)} ·{' '}
              {formatNauticalCoord(selectedWpPoint.lon, false)}
            </div>

            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                const idToDelete = selectedWpPoint.id;
                setSelectedWpId(null);
                onDeleteRoutePoint(idToDelete);
              }}
              title="Elimina punto (✕)"
              aria-label="Elimina punto"
              className="min-h-[30px] min-w-[30px] px-2 py-1 rounded-md border border-red-500/50 bg-red-500/20 text-red-300 hover:bg-red-500/35 text-xs font-bold flex items-center justify-center shrink-0 active:scale-95"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Hydrographic Symbol Inspector */}
      {selectedFeature && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">
              {selectedFeature.title}
            </div>
            {selectedFeature.subtitle && (
              <div className="text-[11px] text-zinc-300 truncate">
                {selectedFeature.subtitle}
              </div>
            )}
            <div className="font-mono tabular-nums text-[10px] text-zinc-500 mt-0.5">
              {formatNauticalCoord(selectedFeature.lat, true)} ·{' '}
              {formatNauticalCoord(selectedFeature.lon, false)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                onAddRoutePoint({
                  lat: selectedFeature.lat,
                  lon: selectedFeature.lon,
                });
                setSelectedFeature(null);
              }}
              className="min-h-[32px] px-2.5 py-1 rounded-md border border-yellow-400/40 bg-yellow-400/10 text-[11px] font-medium text-yellow-300 hover:bg-yellow-400/20 transition-colors"
            >
              + Punto
            </button>
            <button
              type="button"
              onClick={() => setSelectedFeature(null)}
              aria-label="Chiudi dettaglio simbolo"
              className="min-h-[32px] min-w-[32px] rounded-md border border-zinc-800 bg-black flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Active Route Panel (with trash icon in top-right corner) */}
      {routePoints.length > 0 ? (
        <div className="rounded-xl border border-yellow-400/50 bg-zinc-950 p-3.5 space-y-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                <Route className="w-4 h-4 text-yellow-400" />
                <span>Pannello Rotta Attiva</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                {routePoints.length} {routePoints.length === 1 ? 'punto' : 'punti'}
                {totalRouteDistanceNm !== null && ` · Tot ${totalRouteDistanceNm.toFixed(2)} NM`}
                {etaText !== '--' && ` · ETA ${etaText}`}
                {!hasRealGpsFix && <span className="text-amber-400 ml-1.5">(Pre-GPS)</span>}
              </span>
            </div>

            {/* Trash icon button in top-right corner of routes panel as requested */}
            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                setSelectedWpId(null);
                onClearActiveRoute();
              }}
              title="Elimina rotta attiva (cancella tutti i punti)"
              aria-label="Elimina rotta attiva"
              className="min-h-[32px] px-2.5 rounded-lg border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Elimina rotta</span>
            </button>
          </div>

          {/* Next waypoint bearing and distance telemetry */}
          {targetBearingDeg !== null && nextLegDistanceNm !== null && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black border border-zinc-800 text-xs font-mono">
              <span className="text-yellow-400 font-bold">
                WP 1/{routePoints.length} · Rilevamento {formatHeading3Digits(targetBearingDeg)}°
              </span>
              <span className="text-white tabular-nums">
                Dist {nextLegDistanceNm.toFixed(2)} NM
              </span>
            </div>
          )}

          {/* Route management buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                setShowSavedRoutesModal(true);
              }}
              className="flex-1 min-h-[38px] px-3 rounded-lg bg-yellow-400 text-black text-xs font-bold hover:bg-yellow-300 transition-colors flex items-center justify-center gap-1.5 active:scale-95"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Salva rotta</span>
            </button>

            <button
              type="button"
              onClick={() => {
                unlockMarineAudio();
                setShowSavedRoutesModal(true);
              }}
              className="min-h-[38px] px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Route className="w-4 h-4 text-yellow-400" />
              <span>Libreria rotte ({savedRoutes.length})</span>
            </button>
          </div>
        </div>
      ) : (
        /* Button to Access Saved Routes Library when no route is active */
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => {
              unlockMarineAudio();
              setShowSavedRoutesModal(true);
            }}
            className="w-full min-h-[40px] px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 active:scale-95"
          >
            <Route className="w-4 h-4 text-yellow-400" />
            <span>Rotte Salvate ({savedRoutes.length})</span>
          </button>
        </div>
      )}

      {/* Dedicated Saved Routes Page Modal */}
      <SavedRoutesPage
        isOpen={showSavedRoutesModal}
        onClose={() => setShowSavedRoutesModal(false)}
        savedRoutes={savedRoutes}
        activeRoutePoints={routePoints}
        onSaveCurrentRoute={onSaveCurrentRoute}
        onLoadSavedRoute={handleLoadRouteAndFit}
        onDeleteSavedRoute={onDeleteSavedRoute}
        onClearActiveRoute={() => {
          setSelectedWpId(null);
          onClearActiveRoute();
        }}
      />

      {/* Dedicated Layers & INT-1 Legend Side Panel (rendered via createPortal directly on document.body) */}
      {showLayersModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Livelli carta nautica e legenda simboli"
            className="fixed inset-0 z-[9999] flex justify-end animate-in fade-in duration-150 touch-auto"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-xs"
              onClick={() => setShowLayersModal(false)}
            />

            {/* Side Panel (di lato) on the right */}
            <div className="relative z-10 w-full max-w-sm sm:max-w-md h-full overflow-y-auto overscroll-contain bg-zinc-950 border-l border-zinc-800 p-4 sm:p-5 space-y-4 text-white shadow-2xl flex flex-col justify-between">
              <div className="space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  Livelli Carta &amp; Legenda Nautica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLayersModal(false)}
                aria-label="Chiudi finestra livelli"
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Granular Layer Toggles (with separate Bricole toggle!) */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Visibilità Livelli sulla Carta
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Bricole Toggle (User explicitly asked to remove bricole) */}
                <button
                  type="button"
                  onClick={() => setShowBricole((v) => !v)}
                  aria-pressed={showBricole}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showBricole
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-amber-400 font-bold">|||</span>
                    <span className="truncate">Bricole (Pali &amp; Canali)</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showBricole ? 'bg-amber-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showBricole ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Scogli & Ostacoli Toggle */}
                <button
                  type="button"
                  onClick={() => setShowHazards((v) => !v)}
                  aria-pressed={showHazards}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showHazards
                      ? 'border-red-500/50 bg-red-500/15 text-red-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-red-400 font-bold">+/*</span>
                    <span className="truncate">Scogli &amp; Ostacoli</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showHazards ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showHazards ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Boe & Mede Toggle */}
                <button
                  type="button"
                  onClick={() => setShowBuoys((v) => !v)}
                  aria-pressed={showBuoys}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showBuoys
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-emerald-400 font-bold">▲■</span>
                    <span className="truncate">Boe &amp; Mede IALA</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showBuoys ? 'bg-emerald-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showBuoys ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Fari & Fanali Toggle */}
                <button
                  type="button"
                  onClick={() => setShowLights((v) => !v)}
                  aria-pressed={showLights}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showLights
                      ? 'border-yellow-500/50 bg-yellow-500/15 text-yellow-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-yellow-400 font-bold">★</span>
                    <span className="truncate">Fari &amp; Fanali</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showLights ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showLights ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Isobate EMODnet Depth Toggle */}
                <button
                  type="button"
                  onClick={() => setShowContours((v) => !v)}
                  aria-pressed={showContours}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showContours
                      ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sky-400 font-bold">―</span>
                    <span className="truncate">Isobate (Profondità)</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showContours ? 'bg-sky-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showContours ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Scia GPS Barca Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTrack((v) => !v)}
                  aria-pressed={showTrack}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showTrack
                      ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-cyan-400 font-bold">―</span>
                    <span className="truncate">Scia GPS Barca</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${showTrack ? 'bg-cyan-400 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                    {showTrack ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Linea di Prua Toggle (Direzione di rotta infinita) */}
                <button
                  type="button"
                  onClick={() => setShowHeadingLine((v) => !v)}
                  aria-pressed={showHeadingLine}
                  className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium transition-colors flex items-center justify-between gap-2 text-left ${
                    showHeadingLine
                      ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
                      : 'border-zinc-800 bg-black text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-orange-400 font-bold">―</span>
                    <span className="truncate">Linea di Prua (Rotta)</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      showHeadingLine
                        ? 'bg-orange-500 text-black'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {showHeadingLine ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Reset Track Button */}
              {track.length > 1 && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      unlockMarineAudio();
                      onClearTrack();
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
                  >
                    Azzera scia GPS registrata ({track.length} fix)
                  </button>
                </div>
              )}
            </div>

            {/* Official INT-1 Nautical Symbol Legend */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-800">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Legenda Simboli Nautici Ufficiali (INT-1)
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-red-500/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0">
                    +
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Scoglio sommerso</span>
                    <span className="text-[11px] text-zinc-400">Roccia costantemente sommersa, pericolo per la chiglia</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-red-500/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0">
                    *
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Scoglio affiorante / Secca</span>
                    <span className="text-[11px] text-zinc-400">Roccia visibile con la bassa marea o a fior d&apos;acqua</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-red-500/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0">
                    ╫
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Relitto pericoloso</span>
                    <span className="text-[11px] text-zinc-400">Scafo affondato o semisommerso</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center shrink-0">
                    |||
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Bricola / Meda lagunare</span>
                    <span className="text-[11px] text-zinc-400">Fascio di pali per la delimitazione dei canali navigabili</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0">
                    ▲
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Boa laterale dritta (IALA-A)</span>
                    <span className="text-[11px] text-zinc-400">Conica verde, da lasciare a dritta risalendo il canale</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-red-500/20 text-red-400 font-mono font-bold flex items-center justify-center shrink-0">
                    ■
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Boa laterale sinistra (IALA-A)</span>
                    <span className="text-[11px] text-zinc-400">Cilindrica rossa, da lasciare a sinistra risalendo il canale</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-yellow-400/20 text-yellow-300 font-mono font-bold flex items-center justify-center shrink-0">
                    ★
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Faro o Fanale marittimo</span>
                    <span className="text-[11px] text-zinc-400">Segnale luminoso notturno per atterraggio o imboccatura porto</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">
                    ―
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Linea di prua (Direzione di rotta attuale)</span>
                    <span className="text-[11px] text-zinc-400">Arancione continuo infinito: direzione verso cui punta la prua dell&apos;imbarcazione</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-black border border-zinc-900">
                  <span className="w-7 h-7 rounded-md bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center shrink-0">
                    ―
                  </span>
                  <div>
                    <span className="font-semibold text-white block">Scia GPS &amp; Rotta</span>
                    <span className="text-[11px] text-zinc-400">Cyan: scia del percorso eseguito · Giallo tratteggiato: rotta programmata</span>
                  </div>
                </div>
              </div>
            </div>

              </div>

              {/* Sticky bottom close button */}
              <div className="pt-3 border-t border-zinc-800 sticky bottom-0 bg-zinc-950/95 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setShowLayersModal(false)}
                  className="w-full min-h-[42px] px-4 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Chiudi e torna alla carta</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
