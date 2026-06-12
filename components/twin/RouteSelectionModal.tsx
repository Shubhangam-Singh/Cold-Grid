"use client";

/**
 * Route Selection Modal — a premium glassmorphism panel that appears when
 * dispatching. Shows 2–3 distinct route options (Fastest / Shortest / Coolest)
 * with a driver picker, live route preview, and side-by-side comparison.
 */

import { useMemo, useState } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { planRouteOptions } from "@/lib/city/chennai";
import { DRIVERS, DEFAULT_DRIVER_ID } from "@/lib/engine/drivers";
import { getProduce } from "@/lib/engine/produce";
import { getNode } from "@/lib/city/chennai";

export default function RouteSelectionModal() {
  const pendingDispatch = useColdgridStore((s) => s.pendingDispatch);
  const setPendingDispatch = useColdgridStore((s) => s.setPendingDispatch);
  const dispatch = useColdgridStore((s) => s.dispatch);
  const hourOfDay = useColdgridStore((s) => s.sim.hourOfDay);
  const closedEdgeIds = useColdgridStore((s) => s.sim.closedEdgeIds);

  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [selectedDriverId, setSelectedDriverId] = useState(DEFAULT_DRIVER_ID);

  const routeOptions = useMemo(() => {
    if (!pendingDispatch) return [];
    return planRouteOptions(pendingDispatch.fromId, pendingDispatch.toId, {
      hourOfDay,
      closedEdgeIds,
    });
  }, [pendingDispatch, hourOfDay, closedEdgeIds]);

  if (!pendingDispatch || routeOptions.length === 0) return null;

  const selectedDriver = DRIVERS.find((d) => d.id === selectedDriverId) ?? DRIVERS[0];
  const produce = getProduce(pendingDispatch.produce);
  const origin = getNode(pendingDispatch.fromId);
  const dest = getNode(pendingDispatch.toId);

  const handleDispatch = () => {
    const route = routeOptions[selectedRouteIdx];
    if (!route) return;
    dispatch({
      ...pendingDispatch,
      route: route.edgeIds,
      driverId: selectedDriverId,
    });
  };

  const strategyColors: Record<string, string> = {
    fastest: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    shortest: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    coolest: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  };

  const strategyGlows: Record<string, string> = {
    fastest: "shadow-[0_0_20px_rgba(250,204,21,0.3)]",
    shortest: "shadow-[0_0_20px_rgba(96,165,250,0.3)]",
    coolest: "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-[680px] max-h-[85vh] overflow-y-auto rounded-2xl glass-panel p-6 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
        {/* Top accent line */}
        <div className="absolute top-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin-cyan/50 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
              Route Selection
            </div>
            <h2 className="mt-1 text-xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
              {produce.label}: {origin.name} → {dest.name}
            </h2>
          </div>
          <button
            onClick={() => setPendingDispatch(null)}
            className="rounded-md border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 transition-all hover:border-slate-500 hover:text-white"
          >
            Cancel
          </button>
        </div>

        {/* Driver Picker */}
        <div className="mt-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Assign Driver
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DRIVERS.map((d) => {
              const selected = d.id === selectedDriverId;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDriverId(d.id)}
                  className={[
                    "flex-1 rounded-lg border p-2.5 text-left transition-all duration-300",
                    selected
                      ? "border-twin-cyan/60 bg-twin-cyan/10 shadow-[0_0_15px_rgba(0,240,255,0.2)] scale-[1.02]"
                      : "border-slate-700/50 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{d.avatar}</span>
                    <div>
                      <div className={`text-xs font-semibold ${selected ? "text-twin-cyan" : "text-slate-200"}`}>
                        {d.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{d.title}</div>
                    </div>
                  </div>
                  {selected && (
                    <div className="mt-2 space-y-0.5">
                      <StatBar label="Speed" value={d.speedMultiplier} neutral={1} color="text-yellow-400" />
                      <StatBar label="Fuel" value={d.fuelEfficiency} neutral={1} color="text-green-400" invert />
                      <StatBar label="Reefer" value={d.reeferDiscipline} neutral={1} color="text-cyan-400" />
                      <StatBar label="Traffic" value={d.trafficNavigation} neutral={1} color="text-purple-400" invert />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Route Cards */}
        <div className="mt-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2">
            Choose Route
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${routeOptions.length}, 1fr)` }}>
            {routeOptions.map((r, i) => {
              const selected = i === selectedRouteIdx;
              const colors = strategyColors[r.id] ?? "text-slate-300 border-slate-600 bg-slate-800/50";
              const glow = strategyGlows[r.id] ?? "";

              // Adjust ETA for driver speed
              const adjustedEta = r.estimatedHours / selectedDriver.speedMultiplier;
              // Adjust energy estimate
              const estimatedEnergy =
                pendingDispatch.transportSetpointC != null
                  ? 0.045 * Math.max(0, 32 + r.avgAmbientOffsetC - (pendingDispatch.transportSetpointC ?? 4)) * adjustedEta * selectedDriver.fuelEfficiency
                  : 0;

              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRouteIdx(i)}
                  className={[
                    "rounded-xl border-2 p-4 text-left transition-all duration-300",
                    selected
                      ? `${colors} ${glow} scale-[1.03]`
                      : "border-slate-700/40 bg-slate-900/30 hover:border-slate-600 hover:scale-[1.01]",
                  ].join(" ")}
                >
                  <div className={`text-sm font-bold ${selected ? "" : "text-slate-300"}`}>
                    {r.label}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <MetricRow label="ETA" value={`${(adjustedEta * 60).toFixed(0)} min`} highlight={r.id === "fastest"} />
                    <MetricRow label="Distance" value={`${r.distanceKm.toFixed(1)} km`} highlight={r.id === "shortest"} />
                    <MetricRow
                      label="Temp offset"
                      value={`${r.avgAmbientOffsetC >= 0 ? "+" : ""}${r.avgAmbientOffsetC.toFixed(1)}°C`}
                      highlight={r.id === "coolest"}
                    />
                    {pendingDispatch.transportSetpointC != null && (
                      <MetricRow
                        label="Est. energy"
                        value={`${estimatedEnergy.toFixed(1)} kWh`}
                      />
                    )}
                  </div>

                  <div className="mt-2 font-mono text-[9px] text-slate-600">
                    {r.edgeIds.length} leg{r.edgeIds.length > 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dispatch button */}
        <button
          onClick={handleDispatch}
          className="mt-5 w-full rounded-lg border border-twin-cyan/50 bg-twin-cyan/20 px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.1em] text-twin-cyan shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all duration-300 hover:bg-twin-cyan/30 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
        >
          <span className="flex items-center justify-center gap-2">
            Dispatch with {selectedDriver.name}
            <span className="text-lg">{selectedDriver.avatar}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-semibold ${highlight ? "text-white" : "text-slate-300"}`}>
        {value}
      </span>
    </div>
  );
}

function StatBar({
  label,
  value,
  neutral,
  color,
  invert,
}: {
  label: string;
  value: number;
  neutral: number;
  color: string;
  invert?: boolean;
}) {
  // For "invert" stats, lower is better (fuel, traffic)
  const pct = invert
    ? Math.max(0, Math.min(100, ((neutral * 2 - value) / (neutral * 2)) * 100))
    : Math.max(0, Math.min(100, (value / (neutral * 2)) * 100));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-10 text-[8px] text-slate-600 uppercase">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full bg-current ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
