import React, { useState } from 'react';
import { SpeedSample } from '../types/marine';

interface SpeedChartProps {
  samples: SpeedSample[];
}

export const SpeedChart: React.FC<SpeedChartProps> = ({ samples }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 520;
  const height = 136;
  const padLeft = 32;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 18;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxDataKnots = samples.reduce((acc, s) => Math.max(acc, s.knots), 0);
  const yMax = Math.max(10, Math.ceil((maxDataKnots + 2) / 5) * 5);

  const points = samples.map((s, idx) => {
    const x =
      samples.length <= 1
        ? padLeft + plotW
        : padLeft + (idx / (samples.length - 1)) * plotW;
    const y = padTop + plotH - Math.min(1, s.knots / yMax) * plotH;
    return { x, y, sample: s };
  });

  const linePath =
    points.length > 1
      ? points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : '';

  const activePoint =
    hoverIndex !== null && points[hoverIndex]
      ? points[hoverIndex]
      : points.length > 0
        ? points[points.length - 1]
        : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <div className="flex items-center justify-between gap-2 mb-2 text-xs">
        <span className="text-zinc-400">Andamento Velocità</span>
        {activePoint ? (
          <span className="font-mono tabular-nums text-zinc-200">
            {activePoint.sample.knots.toFixed(1)} Kn ·{' '}
            {activePoint.sample.kmh.toFixed(1)} km/h
          </span>
        ) : (
          <span className="text-zinc-600">Nessun dato</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-crosshair select-none"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          if (points.length === 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const ratio = Math.max(0, Math.min(1, (relX - padLeft) / plotW));
          const idx = Math.round(ratio * (points.length - 1));
          setHoverIndex(idx);
        }}
      >
        {[0, 0.5, 1].map((frac) => {
          const y = padTop + plotH - frac * plotH;
          const val = Math.round(frac * yMax);
          return (
            <g key={frac}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                strokeWidth="1"
                strokeDasharray={frac === 0 ? undefined : '3 3'}
                className="stroke-zinc-800"
              />
              <text
                x={padLeft - 6}
                y={y + 3.5}
                textAnchor="end"
                className="font-mono tabular-nums text-[10px] fill-zinc-500"
              >
                {val}
              </text>
            </g>
          );
        })}

        {points.length > 1 ? (
          <path
            d={linePath}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <text
            x={padLeft + plotW / 2}
            y={padTop + plotH / 2 + 4}
            textAnchor="middle"
            className="text-xs fill-zinc-600"
          >
            In attesa di movimento...
          </text>
        )}

        {activePoint && points.length > 1 && (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="3.5"
            className="fill-white"
          />
        )}
      </svg>
    </div>
  );
};
