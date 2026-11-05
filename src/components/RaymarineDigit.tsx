import React from 'react';

interface RaymarineSevenSegProps {
  x: number;
  y: number;
  width: number;
  height: number;
  thickness: number;
  digit: string | null; // '0'..'9', '-', or null (ghost only)
  ghostOpacity?: number;
}

const DIGIT_SEGMENTS: Record<string, readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  // [A (top), B (top-right), C (bot-right), D (bot), E (bot-left), F (top-left), G (mid)]
  '0': [true, true, true, true, true, true, false],
  '1': [false, true, true, false, false, false, false],
  '2': [true, true, false, true, true, false, true],
  '3': [true, true, true, true, false, false, true],
  '4': [false, true, true, false, false, true, true],
  '5': [true, false, true, true, false, true, true],
  '6': [true, false, true, true, true, true, true],
  '7': [true, true, true, false, false, false, false],
  '8': [true, true, true, true, true, true, true],
  '9': [true, true, true, true, false, true, true],
  '-': [false, false, false, false, false, false, true],
};

/**
 * Precision 45-degree mitered 7-segment LCD digit modeled after the Raymarine i50 Speed/Log
 */
export const RaymarineDigit: React.FC<RaymarineSevenSegProps> = ({
  x,
  y,
  width: W,
  height: H,
  thickness: T,
  digit,
  ghostOpacity = 0.055,
}) => {
  const r = T / 2;
  const g = Math.max(2.2, T * 0.11); // Clean 45° miter channel gap
  const c = Math.max(2.5, T * 0.14); // Subtle outer corner bevel like Raymarine LCD
  const midY = H / 2;

  // Segment A: Top Horizontal
  const segA = [
    `${g + c},0`,
    `${W - g - c},0`,
    `${W - g},${c}`,
    `${W - T - g},${T}`,
    `${T + g},${T}`,
    `${g},${c}`,
  ].join(' ');

  // Segment D: Bottom Horizontal
  const segD = [
    `${T + g},${H - T}`,
    `${W - T - g},${H - T}`,
    `${W - g},${H - c}`,
    `${W - g - c},${H}`,
    `${g + c},${H}`,
    `${g},${H - c}`,
  ].join(' ');

  // Segment G: Middle Horizontal Hexagon
  const segG = [
    `${r + g},${midY}`,
    `${T + g},${midY - r}`,
    `${W - T - g},${midY - r}`,
    `${W - r - g},${midY}`,
    `${W - T - g},${midY + r}`,
    `${T + g},${midY + r}`,
  ].join(' ');

  // Segment F: Top-Left Vertical
  const segF = [
    `0,${g + c}`,
    `${c},${g}`,
    `${T},${T + g}`,
    `${T},${midY - r - g}`,
    `${r},${midY - g}`,
    `0,${midY - r - g}`,
  ].join(' ');

  // Segment B: Top-Right Vertical
  const segB = [
    `${W - c},${g}`,
    `${W},${g + c}`,
    `${W},${midY - r - g}`,
    `${W - r},${midY - g}`,
    `${W - T},${midY - r - g}`,
    `${W - T},${T + g}`,
  ].join(' ');

  // Segment E: Bottom-Left Vertical
  const segE = [
    `0,${midY + r + g}`,
    `${r},${midY + g}`,
    `${T},${midY + r + g}`,
    `${T},${H - T - g}`,
    `${c},${H - g}`,
    `0,${H - g - c}`,
  ].join(' ');

  // Segment C: Bottom-Right Vertical
  const segC = [
    `${W - r},${midY + g}`,
    `${W},${midY + r + g}`,
    `${W},${H - g - c}`,
    `${W - c},${H - g}`,
    `${W - T},${H - T - g}`,
    `${W - T},${midY + r + g}`,
  ].join(' ');

  const polygons = [segA, segB, segC, segD, segE, segF, segG];
  const activeMask = digit && DIGIT_SEGMENTS[digit] ? DIGIT_SEGMENTS[digit] : null;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {polygons.map((pts, idx) => {
        const isLit = activeMask ? activeMask[idx] : false;
        return (
          <polygon
            key={idx}
            points={pts}
            fill="#FFFFFF"
            fillOpacity={isLit ? 1 : ghostOpacity}
          />
        );
      })}
    </g>
  );
};
