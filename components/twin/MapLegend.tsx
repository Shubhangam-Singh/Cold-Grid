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
    <div className="pointer-events-none absolute bottom-6 left-6 z-10 w-64 rounded-xl glass-panel p-4 animate-slide-up">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400 border-b border-white/5 pb-2">
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

      <div className="mt-4 mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Ring = holding temp
      </div>
      <div className="flex overflow-hidden rounded-full border border-slate-700/50 shadow-inner">
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
