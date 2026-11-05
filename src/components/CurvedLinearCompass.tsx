import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatHeading3Digits,
  normalizeDeg360,
  shortestAngleDelta,
} from '../utils/nautical';
import { RaymarineDigit } from './RaymarineDigit';

interface CurvedLinearCompassProps {
  headingDeg: number | null;
  targetBearingDeg?: number | null;
}

const CARDINALS: Record<number, string> = {
  0: 'N',
  45: 'NE',
  90: 'E',
  135: 'SE',
  180: 'S',
  225: 'SO',
  270: 'O',
  315: 'NO',
};

/**
 * Tall High-Visibility Curved Linear Marine Compass (60° visible FOV: -30° to +30°)
 * - Shifted lower from top edge with increased vertical height (`viewBox="0 0 620 392"`).
 * - Enlarged yellow course indicator attached to curved compass coordinates.
 * - Bold 4x-thick yellow directional arrows above the left/right wings when off-scale.
 */
export const CurvedLinearCompass: React.FC<CurvedLinearCompassProps> = ({
  headingDeg,
  targetBearingDeg = null,
}) => {
  const [renderedHeading, setRenderedHeading] = useState<number>(headingDeg ?? 0);
  const currentRef = useRef<number>(headingDeg ?? 0);
  const targetRef = useRef<number>(headingDeg ?? 0);

  useEffect(() => {
    if (headingDeg !== null && Number.isFinite(headingDeg)) {
      targetRef.current = normalizeDeg360(headingDeg);
    }
  }, [headingDeg]);

  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.06, (now - lastTime) / 1000);
      lastTime = now;

      const delta = shortestAngleDelta(currentRef.current, targetRef.current);
      if (Math.abs(delta) > 0.015) {
        const step = delta * Math.min(1, dt * 10.5);
        currentRef.current = normalizeDeg360(currentRef.current + step);
        setRenderedHeading(currentRef.current);
      } else if (currentRef.current !== targetRef.current) {
        currentRef.current = targetRef.current;
        setRenderedHeading(currentRef.current);
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const hasValidHeading = headingDeg !== null && Number.isFinite(headingDeg);
  const digitalText = formatHeading3Digits(hasValidHeading ? renderedHeading : null);
  const headingChars = digitalText.split('');

  // Tall 16:10 marine binnacle geometry: viewBox="0 0 620 392"
  // Scales ~1.55x taller on mobile portrait screens while fitting cleanly on wide screens
  const xCenter = 310;
  const halfWidth = 286; // Active 60° span from -30° (x=24) to +30° (x=596)
  const yApex = 190;
  const sagitta = 36;
  const sin30 = 0.5;

  const arcPath = useMemo(() => {
    const steps = 60;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const deg = -30 + (60 * i) / steps;
      const u = Math.sin((deg * Math.PI) / 180) / sin30;
      const x = xCenter + halfWidth * u;
      const y = yApex + sagitta * u * u;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }, []);

  const lowerArcPath = useMemo(() => {
    const steps = 60;
    const pts: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const deg = -30 + (60 * i) / steps;
      const u = Math.sin((deg * Math.PI) / 180) / sin30;
      const x = xCenter + halfWidth * u;
      const y = yApex + sagitta * u * u + 72;
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }, []);

  const ticks = useMemo(() => {
    const baseInt = Math.floor(renderedHeading);
    const items: Array<{
      key: number;
      normDeg: number;
      x: number;
      y: number;
      angleDeg: number;
      isMajor10: boolean;
      isMed5: boolean;
      cardinal?: string;
    }> = [];

    for (let offset = -32; offset <= 32; offset++) {
      const rawDeg = baseInt + offset;
      const delta = rawDeg - renderedHeading;
      if (delta < -30.1 || delta > 30.1) continue;

      const normDeg = ((rawDeg % 360) + 360) % 360;
      const u = Math.sin((delta * Math.PI) / 180) / sin30;
      const x = xCenter + halfWidth * u;
      const y = yApex + sagitta * u * u;
      const slope = (2 * sagitta * u) / halfWidth;
      const angleDeg = (Math.atan(slope) * 180) / Math.PI;

      items.push({
        key: rawDeg,
        normDeg,
        x,
        y,
        angleDeg,
        isMajor10: normDeg % 10 === 0,
        isMed5: normDeg % 5 === 0 && normDeg % 10 !== 0,
        cardinal: CARDINALS[normDeg],
      });
    }

    return items;
  }, [renderedHeading]);

  // Compute Enlarged Yellow Waypoint Indicator or Thick Top-Left / Top-Right Yellow Arrow
  const waypointIndicator = useMemo(() => {
    if (targetBearingDeg === null || !Number.isFinite(targetBearingDeg)) {
      return null;
    }
    const delta = shortestAngleDelta(renderedHeading, targetBearingDeg);

    if (delta < -30) {
      return { mode: 'LEFT' as const };
    }
    if (delta > 30) {
      return { mode: 'RIGHT' as const };
    }

    const u = Math.sin((delta * Math.PI) / 180) / sin30;
    const x = xCenter + halfWidth * u;
    const y = yApex + sagitta * u * u;
    const slope = (2 * sagitta * u) / halfWidth;
    const angleDeg = (Math.atan(slope) * 180) / Math.PI;

    return {
      mode: 'ON_SCALE' as const,
      x,
      y,
      angleDeg,
    };
  }, [renderedHeading, targetBearingDeg]);

  return (
    <section
      aria-label="Bussola lineare curva a 60 gradi"
      className="shrink-0 w-full border-b border-zinc-900 pt-7 sm:pt-9 pb-2 px-1 sm:px-4 overflow-hidden select-none"
    >
      <div className="w-full max-w-5xl mx-auto">
        <svg
          viewBox="0 0 620 392"
          className="w-full h-64 sm:h-78 lg:h-86 block overflow-hidden"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Rotta istantanea ${digitalText} gradi, bussola curva 60 gradi`}
        >
          <defs>
            <linearGradient id="rayCompassTallBandFade" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="black" />
              <stop offset="3%" stopColor="black" />
              <stop offset="11%" stopColor="white" />
              <stop offset="89%" stopColor="white" />
              <stop offset="97%" stopColor="black" />
              <stop offset="100%" stopColor="black" />
            </linearGradient>
            <mask id="rayCompassTallBandMask">
              <rect x="0" y="120" width="620" height="272" fill="url(#rayCompassTallBandFade)" />
            </mask>
          </defs>

          {/* THICK YELLOW LEFT ARROW (length 170, glides smoothly left/right by 170/7 = 24.29 units) */}
          {waypointIndicator?.mode === 'LEFT' && (
            <g aria-label="Accosta a sinistra" className="animate-helm-arrow-left">
              <polygon
                points="28,62 98,8 98,30 198,30 198,94 98,94 98,116"
                fill="#FACC15"
                stroke="#000000"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* THICK YELLOW RIGHT ARROW (length 170, glides smoothly right/left by 170/7 = 24.29 units) */}
          {waypointIndicator?.mode === 'RIGHT' && (
            <g aria-label="Accosta a destra" className="animate-helm-arrow-right">
              <polygon
                points="592,62 522,8 522,30 422,30 422,94 522,94 522,116"
                fill="#FACC15"
                stroke="#000000"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* LARGE INSTANTANEOUS COURSE DEGREES (000°) AT TOP CENTER */}
          <g transform="translate(213, 14)">
            <g transform="skewX(-2.5)">
              <RaymarineDigit
                x={0}
                y={0}
                width={48}
                height={94}
                thickness={11.5}
                digit={headingChars[0]}
                ghostOpacity={0.07}
              />
              <RaymarineDigit
                x={62}
                y={0}
                width={48}
                height={94}
                thickness={11.5}
                digit={headingChars[1]}
                ghostOpacity={0.07}
              />
              <RaymarineDigit
                x={124}
                y={0}
                width={48}
                height={94}
                thickness={11.5}
                digit={headingChars[2]}
                ghostOpacity={0.07}
              />
            </g>
            <circle
              cx="191"
              cy="15"
              r="9"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="5"
            />
          </g>

          {/* Upper and Lower Curved Compass Rails (tall 72-unit scale height) */}
          <path d={arcPath} fill="none" strokeWidth="2.6" className="stroke-zinc-600" />
          <path d={lowerArcPath} fill="none" strokeWidth="1.4" className="stroke-zinc-800" />

          {/* Tall 60° Scale Ticks & Large Compass Degree Numbers */}
          <g
            mask="url(#rayCompassTallBandMask)"
            className={hasValidHeading ? 'opacity-100' : 'opacity-45'}
          >
            {ticks.map((t) => {
              const tickLen = t.isMajor10 ? 72 : t.isMed5 ? 44 : 22;
              const isNorth = t.normDeg === 0;

              return (
                <g
                  key={t.key}
                  transform={`translate(${t.x.toFixed(2)}, ${t.y.toFixed(2)}) rotate(${t.angleDeg.toFixed(2)})`}
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2={tickLen}
                    strokeWidth={isNorth ? 4.4 : t.isMajor10 ? 3.2 : t.isMed5 ? 2.1 : 1.3}
                    className={
                      isNorth
                        ? 'stroke-white'
                        : t.isMajor10
                          ? 'stroke-zinc-100'
                          : t.isMed5
                            ? 'stroke-zinc-400'
                            : 'stroke-zinc-700'
                    }
                  />

                  {t.cardinal && (
                    <text
                      x="0"
                      y="-18"
                      textAnchor="middle"
                      className={`font-sans tracking-wider ${
                        isNorth
                          ? 'text-[38px] font-bold fill-white'
                          : 'text-[30px] font-bold fill-zinc-300'
                      }`}
                    >
                      {t.cardinal}
                    </text>
                  )}

                  {t.isMajor10 && (
                    <text
                      x="0"
                      y="116"
                      textAnchor="middle"
                      className={`font-sans tracking-wider text-[38px] ${
                        isNorth ? 'font-bold fill-white' : 'font-bold fill-zinc-100'
                      }`}
                    >
                      {t.normDeg.toString().padStart(3, '0')}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* ENLARGED YELLOW WAYPOINT COURSE INDICATOR ATTACHED TO COMPASS COORDINATES */}
          {waypointIndicator?.mode === 'ON_SCALE' && (
            <g
              transform={`translate(${waypointIndicator.x.toFixed(2)}, ${waypointIndicator.y.toFixed(
                2
              )}) rotate(${waypointIndicator.angleDeg.toFixed(2)})`}
            >
              {/* Giant Notched Yellow Autopilot Heading Crown */}
              <polygon
                points="-34,-44 34,-44 34,-10 13,-10 0,8 -13,-10 -34,-10"
                fill="#FACC15"
                stroke="#000000"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              {/* Extra-Thick Full-Height Yellow Cursor Bar across the tall compass band */}
              <line
                x1="0"
                y1="4"
                x2="0"
                y2="78"
                stroke="#FACC15"
                strokeWidth="10.5"
                strokeLinecap="round"
              />
              {/* Large Lower Yellow Clamping Pointer */}
              <polygon
                points="0,62 -22,94 22,94"
                fill="#FACC15"
                stroke="#000000"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Tall Center White Lubber Pointer (Linea di Fede) */}
          <g transform={`translate(${xCenter}, ${yApex})`}>
            <polygon
              points="0,3 -16,-24 16,-24"
              fill="#FFFFFF"
              stroke="#000000"
              strokeWidth="1.8"
            />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="76"
              stroke="#FFFFFF"
              strokeWidth="4.8"
            />
          </g>
        </svg>
      </div>
    </section>
  );
};
