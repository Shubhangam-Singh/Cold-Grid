"use client";

/**
 * Control-room legend: node-type key (shape + label, not color alone) and the
 * temperature ramp the node rings use, with numeric labels for accessibility.
 */

import { NODE_TYPE_STYLE, TEMP_LEGEND, rgbCss, tempToRgb } from "./colors";
import type { NodeType } from "@/lib/city/chennai";

const TYPES: NodeType[] = ["source", "hub", "retail"];

export default function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-60 rounded-lg border border-slate-800 bg-slate-950/85 p-3 backdrop-blur">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Legend
      </div>

      <div className="space-y-1.5">
        {TYPES.map((t) => (
          <div key={t} className="flex items-center gap-2 text-xs text-slate-300">
            <span
              aria-hidden
              className="inline-flex h-4 w-4 items-center justify-center text-[11px] text-slate-300"
            >
              {NODE_TYPE_STYLE[t].glyph}
            </span>
            <span>{NODE_TYPE_STYLE[t].label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Ring = holding temp
      </div>
      <div className="flex overflow-hidden rounded">
        {TEMP_LEGEND.map((stop) => (
          <div
            key={stop.label}
            className="h-2 flex-1"
            style={{ backgroundColor: rgbCss(tempToRgb(stop.tC)) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
        {TEMP_LEGEND.map((stop) => (
          <span key={stop.label}>{stop.label}</span>
        ))}
      </div>
    </div>
  );
}
