import React from 'react';
import { SimulatorControls } from '../types/marine';
import { formatHeading3Digits, knotsToKmh, normalizeDeg360 } from '../utils/nautical';

interface SimulatorPanelProps {
  controls: SimulatorControls;
  onChange: React.Dispatch<React.SetStateAction<SimulatorControls>>;
  onExitSimulator: () => void;
}

const SPEED_PRESETS = [
  { label: '0 Kn', knots: 0.0 },
  { label: '6 Kn', knots: 6.0 },
  { label: '16 Kn', knots: 16.0 },
  { label: '28 Kn', knots: 28.0 },
];

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  controls,
  onChange,
}) => {
  const adjustHeading = (delta: number) => {
    onChange((prev) => ({
      ...prev,
      targetHeading: Math.round(normalizeDeg360(prev.targetHeading + delta)),
    }));
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4 space-y-4">
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between text-xs">
          <label htmlFor="sim-knots-slider" className="text-zinc-400">
            Velocità Simulata
          </label>
          <span className="font-mono tabular-nums text-white">
            {controls.targetKnots.toFixed(1)} Kn ·{' '}
            {knotsToKmh(controls.targetKnots).toFixed(1)} km/h
          </span>
        </div>

        <input
          id="sim-knots-slider"
          type="range"
          min={0}
          max={45}
          step={0.5}
          value={controls.targetKnots}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              targetKnots: parseFloat(e.target.value),
            }))
          }
          className="w-full helm-slider"
        />

        <div className="grid grid-cols-4 gap-1.5">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                onChange((prev) => ({ ...prev, targetKnots: preset.knots }))
              }
              className={`min-h-[38px] px-2 py-1 text-xs font-mono rounded-lg border transition-colors whitespace-nowrap ${
                Math.abs(controls.targetKnots - preset.knots) < 0.2
                  ? 'border-white bg-white text-black font-semibold'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 pt-3 border-t border-zinc-900">
        <div className="flex items-baseline justify-between text-xs">
          <label htmlFor="sim-heading-slider" className="text-zinc-400">
            Rotta Simulata
          </label>
          <span className="font-mono tabular-nums text-white">
            {formatHeading3Digits(controls.targetHeading)}°
          </span>
        </div>

        <input
          id="sim-heading-slider"
          type="range"
          min={0}
          max={359}
          step={1}
          value={controls.targetHeading}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              targetHeading: parseInt(e.target.value, 10),
            }))
          }
          className="w-full helm-slider"
        />

        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => adjustHeading(-10)}
            className="min-h-[38px] px-2 py-1 text-xs font-mono rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            -10°
          </button>
          <button
            type="button"
            onClick={() => adjustHeading(-1)}
            className="min-h-[38px] px-2 py-1 text-xs font-mono rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            -1°
          </button>
          <button
            type="button"
            onClick={() => adjustHeading(1)}
            className="min-h-[38px] px-2 py-1 text-xs font-mono rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            +1°
          </button>
          <button
            type="button"
            onClick={() => adjustHeading(10)}
            className="min-h-[38px] px-2 py-1 text-xs font-mono rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            +10°
          </button>
        </div>
      </div>
    </div>
  );
};
