/**
 * Shared visual encodings for the twin map.
 *
 * Accessibility note (full pass is Phase 8): color is never the ONLY channel —
 * node type is also encoded by ring radius, and tooltips/legend carry numeric
 * labels. The temperature ramp below is a perceptually-ordered cold→hot scale.
 */

import type { NodeType } from "@/lib/city/chennai";

export type RGB = [number, number, number];

/** Linear interpolate between two RGB colors. */
function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Cold-chain temperature ramp stops (°C → color).
const TEMP_STOPS: { t: number; c: RGB }[] = [
  { t: 0, c: [56, 189, 248] }, // deep cold — cyan
  { t: 8, c: [45, 212, 191] }, // chilled — teal
  { t: 20, c: [163, 230, 53] }, // cool ambient — lime
  { t: 30, c: [250, 204, 21] }, // warm — amber
  { t: 36, c: [249, 115, 22] }, // hot — orange
  { t: 44, c: [239, 68, 68] }, // dangerous — red
];

/** Map a temperature (°C) to a ramp color. */
export function tempToRgb(tC: number): RGB {
  if (tC <= TEMP_STOPS[0].t) return TEMP_STOPS[0].c;
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (tC >= last.t) return last.c;
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const lo = TEMP_STOPS[i];
    const hi = TEMP_STOPS[i + 1];
    if (tC >= lo.t && tC <= hi.t) {
      return lerp(lo.c, hi.c, (tC - lo.t) / (hi.t - lo.t));
    }
  }
  return last.c;
}

// Quality ramp stops (0–100 → color): fresh green → at-risk amber → spoiled red.
const QUALITY_STOPS: { q: number; c: RGB }[] = [
  { q: 0, c: [239, 68, 68] }, // spoiled — red
  { q: 35, c: [249, 115, 22] }, // critical — orange
  { q: 60, c: [250, 204, 21] }, // at-risk — amber
  { q: 100, c: [34, 197, 94] }, // fresh — green
];

/** Map a quality value (0–100) to its freshness color. */
export function qualityToRgb(quality: number): RGB {
  const q = Math.max(0, Math.min(100, quality));
  for (let i = 0; i < QUALITY_STOPS.length - 1; i++) {
    const lo = QUALITY_STOPS[i];
    const hi = QUALITY_STOPS[i + 1];
    if (q >= lo.q && q <= hi.q) {
      return lerp(lo.c, hi.c, (q - lo.q) / (hi.q - lo.q));
    }
  }
  return QUALITY_STOPS[QUALITY_STOPS.length - 1].c;
}

/** CSS rgb() string from an RGB triple (for the legend / HTML tooltip). */
export function rgbCss(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Per-node-type visual style. radiusPx is the ring size; fill is the muted core. */
export const NODE_TYPE_STYLE: Record<
  NodeType,
  { label: string; radiusPx: number; fill: RGB; glyph: string }
> = {
  source: { label: "Source / wholesale", radiusPx: 13, fill: [15, 23, 42], glyph: "▲" },
  hub: { label: "Cold-storage hub", radiusPx: 11, fill: [8, 47, 73], glyph: "■" },
  retail: { label: "Retail / vendor zone", radiusPx: 8, fill: [30, 41, 59], glyph: "●" },
};

/** Legend ramp swatches (label + color), coarse sampling of the temp ramp. */
export const TEMP_LEGEND: { label: string; tC: number }[] = [
  { label: "≤4°", tC: 4 },
  { label: "12°", tC: 12 },
  { label: "20°", tC: 20 },
  { label: "30°", tC: 30 },
  { label: "36°", tC: 36 },
  { label: "≥44°", tC: 44 },
];
