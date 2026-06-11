"use client";

/**
 * Live shipment roster: each active/delivered shipment with a quality bar, its
 * route, and status. Reads straight from the store's simulation state.
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { getNode } from "@/lib/city/chennai";
import { getProduce } from "@/lib/engine/produce";
import { qualityToRgb, rgbCss } from "./colors";

export default function ShipmentPanel() {
  const shipments = useColdgridStore((s) => s.sim.shipments);

  const delivered = shipments.filter((s) => s.status === "delivered");
  const spoiled = shipments.filter((s) => s.batch.quality <= 0).length;

  return (
    <div className="w-72 rounded-xl glass-panel p-4 animate-slide-up">
      <div className="mb-3 flex items-baseline justify-between border-b border-white/5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Shipments
        </span>
        <span className="font-mono text-[10px] text-twin-cyan text-glow">
          {shipments.length} total · {delivered.length} done · {spoiled} spoiled
        </span>
      </div>

      {shipments.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500 italic">
          Dispatch a shipment, then press play.
        </p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {[...shipments].reverse().map((s) => {
            const profile = getProduce(s.produce);
            const q = s.batch.quality;
            const color = rgbCss(qualityToRgb(q));
            const isSpoiled = q <= 0;
            return (
              <li key={s.id} className="relative overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 shadow-inner transition-transform hover:scale-[1.02]">
                {/* Glowing subtle background indicating quality */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: color }} />
                
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-sm font-bold text-white drop-shadow-md">
                    {profile.label}{" "}
                    <span className="font-mono text-[10px] text-slate-400 font-normal ml-1">#{s.id.slice(0, 4)}</span>
                  </span>
                  <span className="font-mono text-sm font-bold text-glow" style={{ color }}>
                    {q.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800/80 border border-slate-700">
                  <div
                    className="h-full rounded-full transition-all duration-300 shadow-[0_0_8px_currentColor]"
                    style={{ width: `${q}%`, backgroundColor: color }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.05em] text-slate-400 relative z-10">
                  <span>
                    {getNode(s.originId).name.split(" ")[0]} →{" "}
                    {getNode(s.destinationId).name.split(" ")[0]}
                  </span>
                  <span className={s.status === "delivered" ? "text-twin-emerald text-glow" : (isSpoiled ? "text-twin-danger animate-pulse text-glow" : "text-twin-cyan text-glow")}>
                    {isSpoiled ? "SPOILED" : s.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
