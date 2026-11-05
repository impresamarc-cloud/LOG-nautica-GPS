import L from 'leaflet';

export enum NauticalCategory {
  HAZARD = 'HAZARD',
  AID = 'AID',
}

export enum NauticalSymbolKind {
  ROCK_SUBMERGED = 'ROCK_SUBMERGED',
  ROCK_AWASH = 'ROCK_AWASH',
  REEF = 'REEF',
  WRECK = 'WRECK',
  OBSTRUCTION = 'OBSTRUCTION',
  BUOY_PORT = 'BUOY_PORT',
  BUOY_STARBOARD = 'BUOY_STARBOARD',
  BUOY_CARDINAL = 'BUOY_CARDINAL',
  BUOY_DANGER = 'BUOY_DANGER',
  BUOY_SAFE = 'BUOY_SAFE',
  BUOY_SPECIAL = 'BUOY_SPECIAL',
  MOORING = 'MOORING',
  BRICOLA = 'BRICOLA',
  BEACON = 'BEACON',
  LIGHT = 'LIGHT',
  ANCHORAGE = 'ANCHORAGE',
}

export interface NauticalPointFeature {
  id: string;
  lat: number;
  lon: number;
  category: NauticalCategory;
  kind: NauticalSymbolKind;
  priority: number;
  minZoom: number;
  title: string;
  subtitle: string | null;
  accentColor: string;
}

export interface NauticalLineFeature {
  id: string;
  category: NauticalCategory;
  kind: 'CABLE' | 'PIPELINE';
  title: string;
  coordinates: [number, number][][]; // Array of [lat, lon] polylines
}

export interface HydrographicDataset {
  points: NauticalPointFeature[];
  lines: NauticalLineFeature[];
  updatedAtIso: string | null;
}

interface RawGeoJSONFeature {
  type: 'Feature';
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'MultiLineString'; coordinates: [number, number][][] }
    | null;
  properties?: {
    osm_id?: number | string;
    tags?: Record<string, string | undefined>;
  };
}

interface PostpassResponse {
  postpass_properties?: {
    timestamp?: string;
  };
  features?: RawGeoJSONFeature[];
}

const POSTPASS_ENDPOINT = 'https://postpass.geofabrik.de/api/interpreter';
const OVERPASS_FALLBACK_ENDPOINT = 'https://overpass.private.coffee/api/interpreter';

// In-memory spatial cache keyed by quantized 0.08° grid cells so panning/zooming stays instant
const hydroCache = new Map<string, HydrographicDataset>();

function extractSeamarkColour(tags: Record<string, string | undefined>): string {
  for (const [k, v] of Object.entries(tags)) {
    if (v && k.startsWith('seamark:') && k.endsWith(':colour')) {
      return v.toLowerCase();
    }
  }
  return (tags['colour'] || '').toLowerCase();
}

function formatLightDetails(tags: Record<string, string | undefined>): string | null {
  const char =
    tags['seamark:light:character'] || tags['seamark:light:1:character'] || '';
  const colRaw =
    tags['seamark:light:colour'] || tags['seamark:light:1:colour'] || '';
  const period =
    tags['seamark:light:period'] || tags['seamark:light:1:period'] || '';
  const range =
    tags['seamark:light:range'] || tags['seamark:light:1:range'] || '';

  const colMap: Record<string, string> = {
    white: 'B',
    red: 'R',
    green: 'V',
    yellow: 'G',
    amber: 'G',
  };
  const colShort = colMap[colRaw.toLowerCase()] || colRaw.slice(0, 1).toUpperCase();

  const parts: string[] = [];
  if (char) parts.push(char);
  if (colShort) parts.push(colShort);
  if (period) parts.push(`${period}s`);
  if (range) parts.push(`${range}M`);

  return parts.length > 0 ? parts.join(' ') : null;
}

function classifyPointFeature(
  id: string,
  lat: number,
  lon: number,
  tags: Record<string, string | undefined>
): NauticalPointFeature | null {
  const sm = tags['seamark:type'] || '';
  const nat = tags['natural'] || '';
  const mm = tags['man_made'] || '';
  const hist = tags['historic'] || '';
  const name = tags['seamark:name'] || tags['name'] || '';
  const depth =
    tags['seamark:wreck:depth'] ||
    tags['seamark:rock:depth'] ||
    tags['seamark:obstruction:depth'] ||
    tags['depth'] ||
    tags['ele'] ||
    '';

  const withNameAndDepth = (baseSub: string | null): string | null => {
    const tokens: string[] = [];
    if (name) tokens.push(name);
    if (baseSub) tokens.push(baseSub);
    if (depth && !Number.isNaN(Number(depth))) {
      tokens.push(`Prof. ${Math.abs(Number(depth))} m`);
    }
    return tokens.length > 0 ? tokens.join(' · ') : null;
  };

  // 1. WRECKS (Relitti)
  if (sm === 'wreck' || hist === 'wreck') {
    const cat = tags['seamark:wreck:category'] || '';
    const isDangerous = cat.includes('dangerous') || cat.includes('mast') || cat.includes('hull');
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.HAZARD,
      kind: NauticalSymbolKind.WRECK,
      priority: 98,
      minZoom: 10,
      title: isDangerous ? 'Relitto pericoloso' : 'Relitto sommerso',
      subtitle: withNameAndDepth(null),
      accentColor: '#DC2626',
    };
  }

  // 2. ISOLATED DANGER BUOYS / BEACONS
  if (sm === 'buoy_isolated_danger' || sm === 'beacon_isolated_danger') {
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: NauticalSymbolKind.BUOY_DANGER,
      priority: 96,
      minZoom: 10,
      title:
        sm === 'buoy_isolated_danger'
          ? 'Boa di pericolo isolato'
          : 'Meda di pericolo isolato',
      subtitle: withNameAndDepth('Nero/Rossa · 2 sfere nere'),
      accentColor: '#DC2626',
    };
  }

  // 3. MAJOR & MINOR LIGHTS / LIGHTHOUSES (Fari e Fanali)
  if (sm === 'light_major' || sm === 'light_minor' || mm === 'lighthouse') {
    const lightCol =
      tags['seamark:light:colour'] || tags['seamark:light:1:colour'] || '';
    let accent = '#D946EF'; // Standard INT-1 chart magenta flare
    if (lightCol === 'red') accent = '#EF4444';
    else if (lightCol === 'green') accent = '#16A34A';
    else if (lightCol === 'yellow' || lightCol === 'amber') accent = '#F59E0B';

    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: NauticalSymbolKind.LIGHT,
      priority: sm === 'light_major' || mm === 'lighthouse' ? 95 : 86,
      minZoom: sm === 'light_major' || mm === 'lighthouse' ? 10 : 11,
      title:
        sm === 'light_major' || mm === 'lighthouse' ? 'Faro nautico' : 'Fanale nautico',
      subtitle: withNameAndDepth(formatLightDetails(tags)),
      accentColor: accent,
    };
  }

  // 4. CARDINAL BUOYS & BEACONS (Boe / Mede Cardinali N-E-S-W)
  if (sm === 'buoy_cardinal' || sm === 'beacon_cardinal') {
    const cat =
      tags['seamark:buoy_cardinal:category'] ||
      tags['seamark:beacon_cardinal:category'] ||
      '';
    const dirLabelMap: Record<string, string> = {
      north: 'Nord (acque sicure a N)',
      east: 'Est (acque sicure a E)',
      south: 'Sud (acque sicure a S)',
      west: 'Ovest (acque sicure a W)',
    };
    const isBeacon = sm === 'beacon_cardinal';
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: isBeacon ? NauticalSymbolKind.BEACON : NauticalSymbolKind.BUOY_CARDINAL,
      priority: 90,
      minZoom: 10,
      title: isBeacon ? 'Meda cardinale' : 'Boa cardinale',
      subtitle: withNameAndDepth(dirLabelMap[cat] || 'Giallo/Nera'),
      accentColor: '#EAB308',
    };
  }

  // 5. LATERAL BUOYS & BEACONS (Boe / Mede Laterali IALA-A Rossa/Verde)
  if (sm === 'buoy_lateral' || sm === 'beacon_lateral') {
    const col = extractSeamarkColour(tags);
    const cat =
      tags['seamark:buoy_lateral:category'] ||
      tags['seamark:beacon_lateral:category'] ||
      '';
    const isGreen = col.includes('green') || cat === 'starboard';
    const isRed = col.includes('red') || cat === 'port';
    const isBeacon = sm === 'beacon_lateral';

    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: isBeacon
        ? NauticalSymbolKind.BEACON
        : isGreen
          ? NauticalSymbolKind.BUOY_STARBOARD
          : NauticalSymbolKind.BUOY_PORT,
      priority: 88,
      minZoom: 11,
      title: isBeacon
        ? isGreen
          ? 'Meda laterale dritta (Verde)'
          : isRed
            ? 'Meda laterale sinistra (Rossa)'
            : 'Meda laterale'
        : isGreen
          ? 'Boa laterale dritta (Verde)'
          : isRed
            ? 'Boa laterale sinistra (Rossa)'
            : 'Boa laterale',
      subtitle: withNameAndDepth(formatLightDetails(tags)),
      accentColor: isGreen ? '#16A34A' : '#EF4444',
    };
  }

  // 6. SAFE WATER & SPECIAL PURPOSE BUOYS / BEACONS
  if (
    sm === 'buoy_safe_water' ||
    sm === 'beacon_safe_water' ||
    sm === 'buoy_special_purpose' ||
    sm === 'beacon_special_purpose' ||
    mm === 'buoy' ||
    mm === 'beacon'
  ) {
    const isSafe = sm.includes('safe_water');
    const isBeacon = sm.startsWith('beacon') || mm === 'beacon';
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: isSafe
        ? NauticalSymbolKind.BUOY_SAFE
        : isBeacon
          ? NauticalSymbolKind.BEACON
          : NauticalSymbolKind.BUOY_SPECIAL,
      priority: 82,
      minZoom: 11,
      title: isSafe
        ? 'Segnale acque sicure'
        : isBeacon
          ? 'Meda / Segnale speciale'
          : 'Boa speciale / Segnalamento',
      subtitle: withNameAndDepth(formatLightDetails(tags)),
      accentColor: isSafe ? '#EF4444' : '#EAB308',
    };
  }

  // 7. OBSTRUCTIONS, PLATFORMS & MARINE FARMS (Ostacoli sommersi / Impianti)
  if (
    sm === 'obstruction' ||
    sm === 'marine_farm' ||
    mm === 'offshore_platform'
  ) {
    const title =
      sm === 'marine_farm'
        ? 'Impianto maricoltura / Mitili'
        : mm === 'offshore_platform'
          ? 'Piattaforma / Struttura in mare'
          : 'Ostacolo sommerso';
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.HAZARD,
      kind: NauticalSymbolKind.OBSTRUCTION,
      priority: 84,
      minZoom: 11,
      title,
      subtitle: withNameAndDepth(tags['seamark:obstruction:category'] || null),
      accentColor: '#EA580C',
    };
  }

  // 8. REEFS, SHOALS & SEABED HAZARDS (Secche & Scogliere)
  if (nat === 'reef' || nat === 'shoal' || sm === 'seabed_area') {
    const surface = tags['seamark:seabed_area:surface'] || '';
    if (sm === 'seabed_area' && surface && !['rock', 'coral', 'stone', 'boulders'].includes(surface)) {
      return null; // Ignore benign sand/mud seabed notes to keep chart clean
    }
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.HAZARD,
      kind: NauticalSymbolKind.REEF,
      priority: 80,
      minZoom: 11,
      title: nat === 'shoal' ? 'Secca / Basso fondale' : 'Scogliera / Secca rocciosa',
      subtitle: withNameAndDepth(null),
      accentColor: '#DC2626',
    };
  }

  // 9. MARINE ROCKS (Scogli sommersi, a fior d'acqua, affioranti)
  if (sm === 'rock') {
    const wl = tags['seamark:rock:water_level'] || '';
    let title = 'Scoglio / Pericolo roccioso';
    let kind = NauticalSymbolKind.ROCK_SUBMERGED;
    if (wl === 'always_dry' || wl === 'covers') {
      title = wl === 'covers' ? 'Scoglio scoprente (marea)' : 'Scoglio affiorante';
      kind = NauticalSymbolKind.ROCK_AWASH;
    } else if (wl === 'awash') {
      title = "Scoglio a fior d'acqua";
      kind = NauticalSymbolKind.ROCK_AWASH;
    } else if (wl === 'submerged') {
      title = 'Scoglio sommerso';
      kind = NauticalSymbolKind.ROCK_SUBMERGED;
    }
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.HAZARD,
      kind,
      priority: 76,
      minZoom: 11,
      title,
      subtitle: withNameAndDepth(null),
      accentColor: '#B91C1C',
    };
  }

  // 10. BRICOLE & PILINGS (Bricole di laguna, Pali di canale, Dame)
  if (mm === 'dolphin' || sm === 'pile') {
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: NauticalSymbolKind.BRICOLA,
      priority: 68,
      minZoom: 12,
      title: 'Bricola / Palo di canale',
      subtitle: withNameAndDepth(formatLightDetails(tags)),
      accentColor: '#92400E',
    };
  }

  // 11. MOORING BUOYS (Boe d'ormeggio / Gavitelli)
  if (sm === 'mooring') {
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: NauticalSymbolKind.MOORING,
      priority: 58,
      minZoom: 13,
      title: "Boa d'ormeggio / Gavitello",
      subtitle: withNameAndDepth(null),
      accentColor: '#0284C7',
    };
  }

  // 12. ANCHORAGES (Zone di ancoraggio / Rade)
  if (sm === 'anchorage' || sm === 'anchor_berth') {
    return {
      id,
      lat,
      lon,
      category: NauticalCategory.AID,
      kind: NauticalSymbolKind.ANCHORAGE,
      priority: 55,
      minZoom: 12,
      title: sm === 'anchor_berth' ? 'Posto di fonda' : 'Rada / Zona ancoraggio',
      subtitle: withNameAndDepth(null),
      accentColor: '#9333EA',
    };
  }

  return null;
}

/**
 * Fetches live OpenStreetMap / OpenSeaMap hydrographic features for a bounding box.
 */
export async function fetchHydrographicFeatures(
  south: number,
  west: number,
  north: number,
  east: number,
  signal?: AbortSignal
): Promise<HydrographicDataset> {
  // Quantize bbox outward to 0.06° steps for high cache hit rate during gentle pans/zooms
  const qStep = 0.06;
  const qS = (Math.floor(south / qStep) * qStep).toFixed(2);
  const qW = (Math.floor(west / qStep) * qStep).toFixed(2);
  const qN = (Math.ceil(north / qStep) * qStep).toFixed(2);
  const qE = (Math.ceil(east / qStep) * qStep).toFixed(2);
  const cacheKey = `${qS},${qW},${qN},${qE}`;

  const cached = hydroCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sql = `SELECT osm_id, tags, CASE WHEN GeometryType(geom) IN ('LINESTRING','MULTILINESTRING') AND tags->>'seamark:type' IN ('cable_submarine','pipeline_submarine') THEN geom ELSE ST_Centroid(geom) END AS geom FROM postpass_pointlinepolygon WHERE geom && ST_MakeEnvelope(${qW}, ${qS}, ${qE}, ${qN}, 4326) AND (tags->>'seamark:type' IN ('rock','wreck','obstruction','seabed_area','buoy_lateral','buoy_cardinal','buoy_isolated_danger','buoy_safe_water','buoy_special_purpose','mooring','beacon_lateral','beacon_cardinal','beacon_isolated_danger','beacon_safe_water','beacon_special_purpose','pile','light_major','light_minor','anchorage','anchor_berth','cable_submarine','pipeline_submarine','marine_farm') OR tags->>'natural' IN ('reef','shoal') OR tags->>'man_made' IN ('dolphin','beacon','buoy','lighthouse','offshore_platform') OR tags->>'historic' = 'wreck') LIMIT 900`;

  try {
    const body = new URLSearchParams({ data: sql });
    const res = await fetch(POSTPASS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: body.toString(),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Postpass HTTP ${res.status}`);
    }

    const json = (await res.json()) as PostpassResponse;
    const dataset = parsePostpassGeoJSON(json);
    if (hydroCache.size > 40) {
      const oldestKey = hydroCache.keys().next().value;
      if (oldestKey) hydroCache.delete(oldestKey);
    }
    hydroCache.set(cacheKey, dataset);
    return dataset;
  } catch (err) {
    if (signal?.aborted) throw err;
    // Fallback to Overpass mirror if Postpass is temporarily unreachable
    return fetchFromOverpassFallback(qS, qW, qN, qE, cacheKey, signal);
  }
}

function parsePostpassGeoJSON(json: PostpassResponse): HydrographicDataset {
  const points: NauticalPointFeature[] = [];
  const lines: NauticalLineFeature[] = [];
  const seenIds = new Set<string>();

  for (const feat of json.features || []) {
    if (!feat.geometry || !feat.properties?.tags) continue;
    const tags = feat.properties.tags;
    const rawId = String(feat.properties.osm_id ?? `${Math.random()}`);

    if (
      feat.geometry.type === 'LineString' ||
      feat.geometry.type === 'MultiLineString'
    ) {
      const sm = tags['seamark:type'];
      if (sm === 'cable_submarine' || sm === 'pipeline_submarine') {
        const lineKey = `L_${rawId}`;
        if (seenIds.has(lineKey)) continue;
        seenIds.add(lineKey);

        const rawMulti =
          feat.geometry.type === 'LineString'
            ? [feat.geometry.coordinates]
            : feat.geometry.coordinates;

        const latLonLines: [number, number][][] = rawMulti.map((seg) =>
          seg.map(([lon, lat]) => [lat, lon])
        );

        lines.push({
          id: lineKey,
          category: NauticalCategory.HAZARD,
          kind: sm === 'pipeline_submarine' ? 'PIPELINE' : 'CABLE',
          title:
            sm === 'pipeline_submarine'
              ? 'Condotta sottomarina'
              : 'Cavo sottomarino',
          coordinates: latLonLines,
        });
      }
      continue;
    }

    if (feat.geometry.type === 'Point') {
      const [lon, lat] = feat.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const ptKey = `P_${rawId}_${lat.toFixed(5)}_${lon.toFixed(5)}`;
      if (seenIds.has(ptKey)) continue;
      seenIds.add(ptKey);

      const classified = classifyPointFeature(ptKey, lat, lon, tags);
      if (classified) {
        points.push(classified);
      }
    }
  }

  // Sort highest priority first for deterministic spatial decluttering
  points.sort((a, b) => b.priority - a.priority);

  return {
    points,
    lines,
    updatedAtIso: json.postpass_properties?.timestamp || null,
  };
}

async function fetchFromOverpassFallback(
  qS: string,
  qW: string,
  qN: string,
  qE: string,
  cacheKey: string,
  signal?: AbortSignal
): Promise<HydrographicDataset> {
  const bbox = `${qS},${qW},${qN},${qE}`;
  const query = `[out:json][timeout:8];(nwr["seamark:type"](${bbox});nwr["natural"="reef"](${bbox});nwr["natural"="shoal"](${bbox});nwr["man_made"="dolphin"](${bbox});nwr["man_made"="lighthouse"](${bbox});nwr["historic"="wreck"](${bbox}););out center 500;`;
  const url = `${OVERPASS_FALLBACK_ENDPOINT}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    return { points: [], lines: [], updatedAtIso: null };
  }
  const data = (await res.json()) as {
    elements?: Array<{
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string | undefined>;
    }>;
  };
  const points: NauticalPointFeature[] = [];
  for (const el of data.elements || []) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined || !el.tags) continue;
    const classified = classifyPointFeature(`O_${el.id}`, lat, lon, el.tags);
    if (classified) points.push(classified);
  }
  points.sort((a, b) => b.priority - a.priority);
  const dataset: HydrographicDataset = { points, lines: [], updatedAtIso: null };
  hydroCache.set(cacheKey, dataset);
  return dataset;
}

export interface NauticalFilterSettings {
  showHazards: boolean;
  showBuoys: boolean;
  showBricole: boolean;
  showLights: boolean;
}

/**
 * Spatial pixel-grid decluttering so symbols remain crisp and visible without crowding at medium zoom,
 * while revealing every individual rock, buoy, and bricola as the skipper zooms in.
 */
export function declutterNauticalFeatures(
  features: NauticalPointFeature[],
  map: L.Map,
  filtersOrHazards: boolean | NauticalFilterSettings,
  showAidsParam?: boolean
): NauticalPointFeature[] {
  const zoom = map.getZoom();
  if (zoom < 10) return [];

  const filters: NauticalFilterSettings =
    typeof filtersOrHazards === 'object'
      ? filtersOrHazards
      : {
          showHazards: filtersOrHazards,
          showBuoys: showAidsParam ?? true,
          showBricole: showAidsParam ?? true,
          showLights: showAidsParam ?? true,
        };

  const bounds = map.getBounds().pad(0.15);

  // Minimum pixel separation per zoom level
  let cellSizePx = 22;
  if (zoom >= 16) cellSizePx = 5;
  else if (zoom >= 15) cellSizePx = 10;
  else if (zoom >= 14) cellSizePx = 14;
  else if (zoom >= 13) cellSizePx = 17;
  else if (zoom >= 12) cellSizePx = 20;

  const occupiedCells = new Set<string>();
  const accepted: NauticalPointFeature[] = [];

  for (const item of features) {
    if (zoom < item.minZoom) continue;

    // Granular toggle checks:
    if (item.kind === NauticalSymbolKind.BRICOLA && !filters.showBricole) {
      continue;
    }
    if (item.kind === NauticalSymbolKind.LIGHT && !filters.showLights) {
      continue;
    }
    if (
      (item.kind === NauticalSymbolKind.BUOY_PORT ||
        item.kind === NauticalSymbolKind.BUOY_STARBOARD ||
        item.kind === NauticalSymbolKind.BUOY_CARDINAL ||
        item.kind === NauticalSymbolKind.BUOY_DANGER ||
        item.kind === NauticalSymbolKind.BUOY_SAFE ||
        item.kind === NauticalSymbolKind.BUOY_SPECIAL ||
        item.kind === NauticalSymbolKind.MOORING ||
        item.kind === NauticalSymbolKind.BEACON ||
        item.kind === NauticalSymbolKind.ANCHORAGE) &&
      !filters.showBuoys
    ) {
      continue;
    }
    if (
      (item.kind === NauticalSymbolKind.ROCK_SUBMERGED ||
        item.kind === NauticalSymbolKind.ROCK_AWASH ||
        item.kind === NauticalSymbolKind.REEF ||
        item.kind === NauticalSymbolKind.WRECK ||
        item.kind === NauticalSymbolKind.OBSTRUCTION) &&
      !filters.showHazards
    ) {
      continue;
    }

    if (!bounds.contains([item.lat, item.lon])) continue;

    const pt = map.project([item.lat, item.lon], zoom);
    const gx = Math.floor(pt.x / cellSizePx);
    const gy = Math.floor(pt.y / cellSizePx);
    const key = `${gx}_${gy}`;

    // Major dangers (wrecks & isolated danger marks) bypass suppression unless exact cell taken
    if (occupiedCells.has(key)) continue;
    occupiedCells.add(key);
    accepted.push(item);
  }

  return accepted;
}

/**
 * Creates crisp, subtle INT-1 / S-52 inspired SVG chart icons with thin white contrast halos
 * so they remain legible on daytime water without dominating the chart.
 */
export function createNauticalSymbolIcon(
  feature: NauticalPointFeature,
  zoom: number
): L.DivIcon {
  const scale = zoom >= 15 ? 1.12 : zoom <= 11 ? 0.88 : 1.0;
  const size = Math.round(18 * scale);
  const half = Math.round(size / 2);

  let svgInner = '';

  switch (feature.kind) {
    case NauticalSymbolKind.ROCK_SUBMERGED:
      // INT-1 Underwater Rock: dotted danger circle + crisp '+' cross with 4 dots
      svgInner = `
        <circle cx="10" cy="10" r="7.5" fill="#38BDF8" fill-opacity="0.22" stroke="#0F172A" stroke-width="1.1" stroke-dasharray="2 1.8"/>
        <path d="M10 5.2V14.8M5.2 10H14.8" stroke="#111827" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="7.3" cy="7.3" r="0.85" fill="#DC2626"/>
        <circle cx="12.7" cy="7.3" r="0.85" fill="#DC2626"/>
        <circle cx="7.3" cy="12.7" r="0.85" fill="#DC2626"/>
        <circle cx="12.7" cy="12.7" r="0.85" fill="#DC2626"/>
      `;
      break;

    case NauticalSymbolKind.ROCK_AWASH:
      // INT-1 Rock awash / covers: asterisk '*' with danger ring
      svgInner = `
        <circle cx="10" cy="10" r="7.5" fill="#FCA5A5" fill-opacity="0.28" stroke="#B91C1C" stroke-width="1.2" stroke-dasharray="2.2 1.6"/>
        <path d="M10 4.8V15.2M5.5 7.4L14.5 12.6M14.5 7.4L5.5 12.6" stroke="#111827" stroke-width="1.55" stroke-linecap="round"/>
      `;
      break;

    case NauticalSymbolKind.REEF:
      // Shallow reef / shoal scalloped danger badge
      svgInner = `
        <circle cx="10" cy="10" r="7.8" fill="#FEF08A" fill-opacity="0.32" stroke="#DC2626" stroke-width="1.3" stroke-dasharray="2.5 1.5"/>
        <path d="M6.2 11.5L8.7 7.5L11.2 11.2L13.8 8.2" stroke="#991B1B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      break;

    case NauticalSymbolKind.WRECK:
      // INT-1 Dangerous Wreck: oval dotted ring + crossed hull line with 3 ribs
      svgInner = `
        <ellipse cx="10" cy="10" rx="8.5" ry="6.4" fill="#FEE2E2" fill-opacity="0.48" stroke="#DC2626" stroke-width="1.3" stroke-dasharray="2.2 1.6"/>
        <path d="M4.8 11.6L15.2 8.4M7.6 7.8L8.8 12.2M10 6.6L11.4 12.2M12.5 6.8L13.6 11" stroke="#7F1D1D" stroke-width="1.55" stroke-linecap="round"/>
      `;
      break;

    case NauticalSymbolKind.OBSTRUCTION:
      // Submerged obstruction '!' inside danger ring
      svgInner = `
        <circle cx="10" cy="10" r="7.5" fill="#FFEDD5" fill-opacity="0.45" stroke="#EA580C" stroke-width="1.35" stroke-dasharray="2.4 1.6"/>
        <path d="M10 6.2V10.8" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="10" cy="13.4" r="1.1" fill="#9A3412"/>
      `;
      break;

    case NauticalSymbolKind.BUOY_PORT:
      // IALA-A Port Hand Buoy (Red Can Buoy slanted right)
      svgInner = `
        <path d="M7.5 14.5L9.2 5.8L13.6 6.8L11.8 14.5Z" fill="#EF4444" stroke="#FFFFFF" stroke-width="1.1" stroke-linejoin="round"/>
        <line x1="6" y1="14.8" x2="14" y2="14.8" stroke="#111827" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="10" cy="14.8" r="1.6" fill="#FFFFFF" stroke="#111827" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.BUOY_STARBOARD:
      // IALA-A Starboard Hand Buoy (Green Conical Buoy)
      svgInner = `
        <polygon points="11.6,4.8 13.8,14.6 7.4,14.6" fill="#16A34A" stroke="#FFFFFF" stroke-width="1.1" stroke-linejoin="round"/>
        <line x1="6" y1="14.8" x2="14" y2="14.8" stroke="#111827" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="10" cy="14.8" r="1.6" fill="#FFFFFF" stroke="#111827" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.BUOY_CARDINAL:
      // Cardinal Buoy (Black & Yellow pillar with double-cone topmark)
      svgInner = `
        <polygon points="10,3.5 12.4,6.8 7.6,6.8" fill="#111827" stroke="#FFFFFF" stroke-width="0.8"/>
        <rect x="8.3" y="7.2" width="3.4" height="3.6" fill="#FACC15" stroke="#111827" stroke-width="0.9"/>
        <rect x="8.3" y="10.8" width="3.4" height="3.6" fill="#111827" stroke="#FFFFFF" stroke-width="0.7"/>
        <circle cx="10" cy="15.2" r="1.5" fill="#FFFFFF" stroke="#111827" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.BUOY_DANGER:
      // Isolated Danger Mark (Black/Red with double black spheres)
      svgInner = `
        <circle cx="10" cy="4.2" r="1.4" fill="#111827" stroke="#FFFFFF" stroke-width="0.7"/>
        <circle cx="10" cy="7.1" r="1.4" fill="#111827" stroke="#FFFFFF" stroke-width="0.7"/>
        <rect x="8.2" y="8.8" width="3.6" height="5.6" rx="0.8" fill="#DC2626" stroke="#111827" stroke-width="1"/>
        <circle cx="10" cy="15.2" r="1.5" fill="#FFFFFF" stroke="#111827" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.BUOY_SAFE:
    case NauticalSymbolKind.BUOY_SPECIAL:
      // Special Purpose / Safe Water Spherical-Pillar Buoy
      svgInner = `
        <path d="M8 14.5L9.2 6.2L12.6 6.8L11.5 14.5Z" fill="${feature.accentColor}" stroke="#111827" stroke-width="1.05" stroke-linejoin="round"/>
        <circle cx="10" cy="14.8" r="1.5" fill="#FFFFFF" stroke="#111827" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.MOORING:
      // Mooring Buoy (Gavitello)
      svgInner = `
        <circle cx="10" cy="10.5" r="4.2" fill="#0284C7" stroke="#FFFFFF" stroke-width="1.2"/>
        <circle cx="10" cy="6.2" r="1.3" fill="none" stroke="#0F172A" stroke-width="1.2"/>
      `;
      break;

    case NauticalSymbolKind.BRICOLA:
      // Venetian / Lagoon Bricola (Clustered timber channel pilings with reflective band)
      svgInner = `
        <rect x="6.5" y="6.2" width="2.2" height="8.8" rx="0.8" fill="#78350F" stroke="#FFFFFF" stroke-width="0.8"/>
        <rect x="11.3" y="6.2" width="2.2" height="8.8" rx="0.8" fill="#78350F" stroke="#FFFFFF" stroke-width="0.8"/>
        <rect x="8.8" y="4.8" width="2.4" height="10.4" rx="0.8" fill="#92400E" stroke="#FFFFFF" stroke-width="0.9"/>
        <rect x="6.3" y="8.2" width="7.4" height="1.9" rx="0.5" fill="#FDE047" stroke="#78350F" stroke-width="0.6"/>
      `;
      break;

    case NauticalSymbolKind.BEACON:
      // Fixed Navigation Beacon / Meda
      svgInner = `
        <polygon points="10,4.5 12.8,14.5 7.2,14.5" fill="${feature.accentColor}" stroke="#FFFFFF" stroke-width="1.1" stroke-linejoin="round"/>
        <line x1="6.2" y1="14.8" x2="13.8" y2="14.8" stroke="#111827" stroke-width="1.5" stroke-linecap="round"/>
      `;
      break;

    case NauticalSymbolKind.LIGHT:
      // INT-1 Light Star + Magenta/Coloured Flare
      svgInner = `
        <path d="M10 9.5L15.8 14.2C16.8 15 15.6 16.8 14.3 15.8L10 9.5Z" fill="${feature.accentColor}" fill-opacity="0.88" stroke="#FFFFFF" stroke-width="0.8"/>
        <circle cx="9.5" cy="9.2" r="3.4" fill="#FACC15" stroke="#111827" stroke-width="1.2"/>
        <circle cx="9.5" cy="9.2" r="1.1" fill="#111827"/>
      `;
      break;

    case NauticalSymbolKind.ANCHORAGE:
      // Classic Nautical Anchor (Rada / Ancoraggio)
      svgInner = `
        <circle cx="10" cy="5.6" r="1.5" fill="none" stroke="#7E22CE" stroke-width="1.4"/>
        <path d="M10 7.2V14.8M7.2 9.2H12.8M6.2 12.2C6.8 14.2 8.2 15 10 15C11.8 15 13.2 14.2 13.8 12.2" fill="none" stroke="#7E22CE" stroke-width="1.5" stroke-linecap="round"/>
      `;
      break;
  }

  return L.divIcon({
    className: 'nautical-div-icon',
    iconSize: [size, size],
    iconAnchor: [half, half],
    html: `
      <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 1.5px rgba(255,255,255,0.92));">
        <svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          ${svgInner}
        </svg>
      </div>
    `,
  });
}
