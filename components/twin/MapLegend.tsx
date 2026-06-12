"use client";

/**
 * Control-room legend: node-type key (shape + label, not color alone) and the
 * temperature ramp the node rings use, with numeric labels for accessibility.
 */

import { NODE_TYPE_STYLE, TEMP_LEGEND, rgbCss, tempToRgb } from "./colors";
import type { NodeType } from "@/lib/city/chennai";
import { useColdgridStore } from "@/store/coldgridStore";

const TYPES: NodeType[] = ["source", "hub", "retail"];

// Spoilage-risk ramp swatches (must match RISK_COLORS in DeckMap).
const RISK_RAMP = ["#1a9850", "#91cf60", "#d9ef8b", "#fee08b", "#fc8d59", "#d73027"];

export default function MapLegend() {
  const showHeatmap = useColdgridStore((s) => s.showHeatmap);
  const toggleHeatmap = useColdgridStore((s) => s.toggleHeatmap);

  return (
    <div className="pointer-events-none w-72 rounded-xl glass-panel p-4 animate-slide-up flex-shrink-0">
      <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Legend
        </span>
        <button
          onClick={toggleHeatmap}
          aria-pressed={showHeatmap}
          className={`pointer-events-auto rounded-md px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan ${
            showHeatmap
              ? "bg-twin-danger/20 text-twin-danger"
              : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
          }`}
        >
          ◍ Risk {showHeatmap ? "on" : "off"}
        </button>
      </div>

      {showHeatmap && (
        <div className="mb-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Spoilage risk
          </div>
          <div className="flex overflow-hidden rounded-full border border-slate-700/50">
            {RISK_RAMP.map((c, i) => (
              <div key={i} className="h-2 flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
            <span>low</span>
            <span>high</span>
          </div>
        </div>
      )}

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
