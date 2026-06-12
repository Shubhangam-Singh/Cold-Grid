"use client";

/**
 * Operator controls (Phase 4): play/pause, speed, quick-dispatch presets, a
 * custom dispatch builder (produce / origin / destination / reefer setpoint), a
 * heatwave toggle (previews the Phase 5 scenario override), clear-delivered,
 * and reset. All wired to the store's pure simulation actions.
 */

import { useEffect, useMemo, useState } from "react";
import { SPEEDS, useColdgridStore } from "@/store/coldgridStore";
import type { DispatchOptions } from "@/lib/engine/simulation";
import { PRODUCE_IDS, getProduce } from "@/lib/engine/produce";
import {
  CHENNAI_NODES,
  planRoute,
  routeDistanceKm,
  routeTravelHours,
} from "@/lib/city/chennai";
import type { ProduceId } from "@/lib/engine/types";

const PRESETS: { label: string; opts: DispatchOptions }[] = [
  { label: "Fish · Kasimedu → Mylapore", opts: { produce: "fish", fromId: "kasimedu", toId: "mylapore" } },
  { label: "Milk · Aavin → Velachery", opts: { produce: "milk", fromId: "aavin-madhavaram", toId: "velachery" } },
  { label: "Tomato · Koyambedu → T. Nagar", opts: { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" } },
];

// Origins: anything that can originate a route (sources + hubs). Destinations:
// hubs + retail (sources have no incoming edges).
const ORIGINS = CHENNAI_NODES.filter((n) => n.type !== "retail");
const DESTINATIONS = CHENNAI_NODES.filter((n) => n.type !== "source");

function btn(active = false) {
  return [
    "rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-300",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan",
    "hover:scale-[1.03] active:scale-[0.97]",
    active 
      ? "bg-twin-cyan/20 text-twin-cyan border border-twin-cyan/50 shadow-[0_0_10px_rgba(0,240,255,0.3)]" 
      : "bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-700/80 hover:border-slate-500",
  ].join(" ");
}

const selectCls =
  "w-full rounded-md bg-slate-900/60 border border-slate-700/50 px-2 py-1.5 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan transition-colors hover:border-slate-500";

export default function SimControls() {
  const isPlaying = useColdgridStore((s) => s.isPlaying);
  const speed = useColdgridStore((s) => s.speed);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const togglePlay = useColdgridStore((s) => s.togglePlay);
  const setSpeed = useColdgridStore((s) => s.setSpeed);
  const setPendingDispatch = useColdgridStore((s) => s.setPendingDispatch);
  const clearDelivered = useColdgridStore((s) => s.clearDelivered);
  const resetSim = useColdgridStore((s) => s.resetSim);
  const setScenarioOffsetC = useColdgridStore((s) => s.setScenarioOffsetC);
  const closedEdgeIds = useColdgridStore((s) => s.sim.closedEdgeIds);

  const [showCustom, setShowCustom] = useState(false);
  const [produce, setProduce] = useState<ProduceId>("fish");
  const [fromId, setFromId] = useState("kasimedu");
  const [toId, setToId] = useState("mylapore");
  const [reefer, setReefer] = useState(false);
  const [setpoint, setSetpoint] = useState(4);

  const heatwave = scenarioOffsetC > 0;

  // Only destinations actually reachable from the chosen origin (≠ origin, and a
  // route exists under the current road closures) — so you can't pick a dead end.
  const validDestinations = useMemo(
    () =>
      DESTINATIONS.filter(
        (n) => n.id !== fromId && planRoute(fromId, n.id, { closedEdgeIds }) !== null
      ),
    [fromId, closedEdgeIds]
  );

  // Keep the destination valid whenever the origin (or closures) change.
  useEffect(() => {
    if (!validDestinations.some((n) => n.id === toId)) {
      setToId(validDestinations[0]?.id ?? "");
    }
  }, [validDestinations, toId]);

  const route = useMemo(
    () => (toId ? planRoute(fromId, toId, { closedEdgeIds }) : null),
    [fromId, toId, closedEdgeIds]
  );
  const canDispatch = route !== null && route.length > 0;

  const dispatchCustom = () => {
    if (!canDispatch) return;
    setPendingDispatch({ produce, fromId, toId, transportSetpointC: reefer ? setpoint : null });
  };

  return (
    <div className="absolute left-6 top-6 z-20 max-h-[calc(100vh-22rem)] w-72 overflow-y-auto rounded-xl glass-panel p-4 animate-slide-up">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Operations
      </div>

      <div className="flex items-center gap-2">
        <button onClick={togglePlay} className={`${btn(isPlaying)} min-w-[64px]`} aria-pressed={isPlaying}>
          {isPlaying ? "❚❚ Pause" : "▶ Play"}
        </button>
        <div className="flex items-center gap-1" role="group" aria-label="Speed">
          {SPEEDS.map((sp) => (
            <button key={sp} onClick={() => setSpeed(sp)} className={btn(speed === sp)} aria-pressed={speed === sp}>
              {sp}×
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Quick dispatch
      </div>
      <div className="mt-1.5 space-y-1.5">
        {PRESETS.map((d) => (
          <button
            key={d.label}
            onClick={() => setPendingDispatch(d.opts)}
            className="block w-full rounded-md border border-transparent bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-200 transition-all duration-300 hover:scale-[1.02] hover:bg-slate-700/60 hover:border-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowCustom((v) => !v)}
        className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-twin-cyan hover:text-white transition-colors duration-300"
        aria-expanded={showCustom}
      >
        {showCustom ? "▾ Custom dispatch" : "▸ Custom dispatch"}
      </button>

      {showCustom && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 shadow-inner">
          <label className="block">
            <span className="sr-only">Produce</span>
            <select className={selectCls} value={produce} onChange={(e) => setProduce(e.target.value as ProduceId)}>
              {PRODUCE_IDS.map((id) => (
                <option key={id} value={id}>
                  {getProduce(id).label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <label className="flex-1">
              <span className="sr-only">Origin</span>
              <select className={selectCls} value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {ORIGINS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-slate-500">→</span>
            <label className="flex-1">
              <span className="sr-only">Destination</span>
              <select className={selectCls} value={toId} onChange={(e) => setToId(e.target.value)}>
                {validDestinations.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="font-mono text-[10px] text-slate-500">
            {canDispatch && route ? (
              <>
                Route: {route.length} leg{route.length > 1 ? "s" : ""} ·{" "}
                {routeDistanceKm(route).toFixed(1)} km · ~{routeTravelHours(route).toFixed(1)} h
              </>
            ) : (
              <span className="text-amber-400">No open route — pick another destination.</span>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={reefer}
              onChange={(e) => setReefer(e.target.checked)}
              className="accent-twin-cyan w-4 h-4"
            />
            Refrigerated truck
          </label>
          {reefer && (
            <label className="flex items-center justify-between text-xs text-slate-400">
              <span>Setpoint</span>
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={setpoint}
                  onChange={(e) => setSetpoint(Number(e.target.value))}
                  className="w-24 accent-twin-cyan cursor-pointer"
                  aria-label="Reefer setpoint °C"
                />
                <span className="w-8 font-mono text-slate-200">{setpoint}°</span>
              </span>
            </label>
          )}

          <button
            onClick={dispatchCustom}
            disabled={!canDispatch}
            className="w-full rounded-md bg-twin-cyan/20 border border-twin-cyan/50 px-3 py-2 text-xs font-bold text-twin-cyan transition-all duration-300 hover:bg-twin-cyan/40 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan disabled:cursor-not-allowed disabled:bg-slate-800/50 disabled:border-slate-700 disabled:text-slate-500 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            Dispatch
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setScenarioOffsetC(heatwave ? 0 : 6)} className={`${btn(heatwave)} ${heatwave ? 'animate-glow-pulse border-twin-danger/50 text-twin-danger bg-twin-danger/20 shadow-[0_0_15px_rgba(255,51,102,0.4)]' : ''}`} aria-pressed={heatwave}>
          {heatwave ? "🔥 Heatwave ON" : "Heatwave OFF"}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={clearDelivered} className="text-xs text-slate-400 transition-colors hover:text-white hover:text-glow">
            Clear done
          </button>
          <button onClick={resetSim} className="text-xs text-slate-400 transition-colors hover:text-white hover:text-glow">
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
