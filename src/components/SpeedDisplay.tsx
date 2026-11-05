import React from 'react';
import { RaymarineDigit } from './RaymarineDigit';

interface SpeedDisplayProps {
  speedKnots: number;
  speedKmh: number;
}

/**
 * Raymarine i50 Speed / Log Display:
 * - Always displays 3 lit 7-segment digits formatted as "00.0" (e.g., 00.0, 06.4, 14.8)
 *   at the balanced Raymarine i50 proportions with small "Kn" on the right
 *   and the km/h correspondence register below.
 */
export const SpeedDisplay: React.FC<SpeedDisplayProps> = ({
  speedKnots,
  speedKmh,
}) => {
  const clampedKnots = Math.min(99.9, Math.max(0, speedKnots));
  const formattedKnots = clampedKnots.toFixed(1).padStart(4, '0'); // Always "00.0" .. "99.9"
  const [intPart, decPart] = formattedKnots.split('.');

  const tensChar = intPart[0];
  const onesChar = intPart[1];
  const tenthsChar = decPart[0];

  const formattedKmh = speedKmh.toFixed(1);

  // Previous balanced Raymarine i50 Speed SVG Geometry (all 3 digits uniform height)
  const digitW = 114;
  const digitH = 348;
  const strokeT = 26;
  const topY = 14;

  const xTens = 18;
  const xOnes = 150;
  const xDot = 278;
  const xTenths = 304;

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col justify-between overflow-hidden select-none">
      {/* Main Raymarine i50 3-Digit "00.0" Knots Register */}
      <section
        aria-label={`Velocità ${formattedKnots} nodi`}
        className="flex-1 min-h-0 w-full flex items-center justify-center px-2 sm:px-6 py-1 overflow-hidden"
      >
        <svg
          viewBox="0 0 476 376"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-full block overflow-hidden"
          role="img"
          aria-label={`${formattedKnots} Kn`}
        >
          <g transform="translate(8, 0) skewX(-2.8)">
            {/* Tens Digit (always lit: 0..9 -> "00.0") */}
            <RaymarineDigit
              x={xTens}
              y={topY}
              width={digitW}
              height={digitH}
              thickness={strokeT}
              digit={tensChar}
              ghostOpacity={0.045}
            />

            {/* Ones Digit */}
            <RaymarineDigit
              x={xOnes}
              y={topY}
              width={digitW}
              height={digitH}
              thickness={strokeT}
              digit={onesChar}
              ghostOpacity={0.045}
            />

            {/* Precision Square-Beveled Decimal Point */}
            <rect
              x={xDot}
              y={topY + digitH - strokeT}
              width={strokeT * 0.88}
              height={strokeT}
              rx={2}
              fill="#FFFFFF"
            />

            {/* Tenths Digit */}
            <RaymarineDigit
              x={xTenths}
              y={topY}
              width={digitW}
              height={digitH}
              thickness={strokeT}
              digit={tenthsChar}
              ghostOpacity={0.045}
            />
          </g>

          {/* Small "Kn" Unit Indicator in Right Margin */}
          <text
            x="430"
            y={topY + digitH - 4}
            textAnchor="start"
            className="font-sans font-bold fill-zinc-400 text-[28px] tracking-tight"
          >
            Kn
          </text>
        </svg>
      </section>

      {/* Lower Log Register: Small km/h Correspondence */}
      <div
        aria-label={`Corrispondenza ${formattedKmh} chilometri orari`}
        className="shrink-0 h-12 sm:h-14 border-t border-zinc-900 flex items-center justify-center gap-2 px-4"
      >
        <span className="font-mono tabular-nums text-xl sm:text-2xl font-semibold tracking-wider text-zinc-300">
          {formattedKmh}
        </span>
        <span className="font-sans text-xs sm:text-sm font-semibold tracking-wider text-zinc-500">
          km/h
        </span>
      </div>
    </div>
  );
};
