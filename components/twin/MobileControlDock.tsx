"use client";

/**
 * Mobile control dock (≤ lg). On phones/tablets the Twin's two fixed side
 * columns would overlap and bury the map, so below the `lg` breakpoint we hide
 * them (see TwinScreen) and surface the same panels here: a top-left FAB opens a
 * left drawer that stacks every operator panel in one scrollable column.
 *
 * Desktop is untouched — this whole component is `lg:hidden`. Panels keep their
 * fixed desktop widths; the `[&>*]:!w-full` wrapper forces them full-width only
 * inside the drawer, so no panel internals need to change.
 */

import { useState } from "react";
import SimControls from "./SimControls";
import CityClock from "./CityClock";
import WeatherWidget from "./WeatherWidget";
import FarmImpactPanel from "./FarmImpactPanel";
import ShipmentPanel from "./ShipmentPanel";
import MapLegend from "./MapLegend";

export default function MobileControlDock() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      {/* Trigger — top-left of the map, clear of the bottom tracking/copilot UI */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open operator controls"
          aria-expanded={false}
          className="absolute left-3 top-3 z-40 flex items-center gap-2 rounded-full glass-panel px-3.5 py-2 text-slate-100 shadow-lg active:scale-95"
        >
          <span className="text-base leading-none">🎛</span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em]">
            Controls
          </span>
        </button>
      )}

      {open && (
        <div className="absolute inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Operator controls">
          {/* Backdrop */}
          <button
            aria-label="Close controls"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/55 animate-fade-in"
          />

          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col border-r border-white/10 bg-[#070b11]/95 shadow-2xl backdrop-blur-md animate-drawer-in">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-twin-cyan text-glow">
                Operator Console
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close controls"
                className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 active:text-white"
              >
                ✕
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3 [&>*]:!w-full [&>*]:max-w-none">
              <SimControls />
              <CityClock />
              <WeatherWidget />
              <FarmImpactPanel />
              <ShipmentPanel />
              <MapLegend />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
