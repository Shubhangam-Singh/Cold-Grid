"use client";

/**
 * Live fleet roster: each PPSC-equipped truck with GPS, cargo sensors, quality,
 * and status. Click a row to select it on the map / tracking card.
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { getNode } from "@/lib/city/chennai";
import { getProduce } from "@/lib/engine/produce";
import { ppscUnitId } from "@/lib/hardware/ppsc";
import { qualityToRgb, rgbCss } from "./colors";
import CargoHealth from "./CargoHealth";

function formatGps(position: [number, number]): string {
  const [lon, lat] = position;
  return `${lat.toFixed(4)}° N  ${Math.abs(lon).toFixed(4)}° E`;
}

export default function ShipmentPanel() {
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const selectedId = useColdgridStore((s) => s.selectedShipmentId);
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);

  const delivered = shipments.filter((s) => s.status === "delivered");
  const live = shipments.filter((s) => s.status === "in-transit");
  const spoiled = shipments.filter((s) => s.batch.quality <= 0).length;

  return (
    <div className="w-72 rounded-xl glass-panel p-4 animate-slide-up">
      <div className="mb-3 flex items-baseline justify-between border-b border-white/5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Fleet
        </span>
        <span className="font-mono text-[10px] text-twin-cyan text-glow">
          {live.length} live · {delivered.length} done · {spoiled} spoiled
        </span>
      </div>

      {shipments.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500 italic">
          No trucks on the network — dispatch a PPSC unit.
        </p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {[...shipments].reverse().map((s) => {
            const profile = getProduce(s.produce);
            const q = s.batch.quality;
            const color = rgbCss(qualityToRgb(q));
            const isSpoiled = q <= 0;
            const selected = s.id === selectedId;
            const unit = ppscUnitId(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedShipment(s.id)}
                  className={`relative w-full overflow-hidden rounded-lg border p-3 text-left shadow-inner transition-transform hover:scale-[1.02] ${
                    selected
                      ? "border-twin-cyan/60 bg-twin-cyan/10"
                      : "border-slate-700/50 bg-slate-900/40"
                  }`}
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: color }} />

                  <div className="flex items-center justify-between relative z-10">
                    <span className="text-sm font-bold text-white drop-shadow-md">
                      {profile.label}{" "}
                      <span className="font-mono text-[10px] text-twin-cyan font-normal ml-1">{unit}</span>
                    </span>
                    <span className="font-mono text-sm font-bold text-glow" style={{ color }}>
                      {q.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-1.5 font-mono text-[10px] text-slate-400 relative z-10">
                    {formatGps(s.position)}
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1 relative z-10">
                    <SensorChip label="T" value={`${s.lastTempC.toFixed(1)}°`} />
                    <SensorChip label="RH" value={`${s.lastRH.toFixed(0)}%`} />
                    <SensorChip label="VOC" value={s.lastVOC.toFixed(0)} />
                  </div>
                  <CargoHealth
                    produce={s.produce}
                    batch={s.batch}
                    T_C={s.lastTempC}
                    RH={s.lastRH}
                    VOC={s.lastVOC}
                    compact
                  />

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
                      {isSpoiled ? "SPOILED" : s.status === "in-transit" ? "LIVE" : s.status}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SensorChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-950/50 px-1 py-1 text-center">
      <div className="font-mono text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-[10px] font-semibold text-slate-200">{value}</div>
    </div>
  );
}
