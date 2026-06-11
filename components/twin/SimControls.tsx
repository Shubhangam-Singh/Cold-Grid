"use client";

/**
 * Operator controls (Phase 4): play/pause, speed, quick-dispatch presets, a
 * custom dispatch builder (produce / origin / destination / reefer setpoint), a
 * heatwave toggle (previews the Phase 5 scenario override), clear-delivered,
 * and reset. All wired to the store's pure simulation actions.
 */

import { useState } from "react";
import { SPEEDS, useColdgridStore } from "@/store/coldgridStore";
import type { DispatchOptions } from "@/lib/engine/simulation";
import { PRODUCE_IDS, getProduce } from "@/lib/engine/produce";
import { CHENNAI_NODES } from "@/lib/city/chennai";
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
    "rounded px-2.5 py-1 text-xs font-medium transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400",
    active ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700",
  ].join(" ");
}

const selectCls =
  "w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400";

export default function SimControls() {
  const isPlaying = useColdgridStore((s) => s.isPlaying);
  const speed = useColdgridStore((s) => s.speed);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const togglePlay = useColdgridStore((s) => s.togglePlay);
  const setSpeed = useColdgridStore((s) => s.setSpeed);
  const dispatch = useColdgridStore((s) => s.dispatch);
  const clearDelivered = useColdgridStore((s) => s.clearDelivered);
  const resetSim = useColdgridStore((s) => s.resetSim);
  const setScenarioOffsetC = useColdgridStore((s) => s.setScenarioOffsetC);

  const [showCustom, setShowCustom] = useState(false);
  const [produce, setProduce] = useState<ProduceId>("fish");
  const [fromId, setFromId] = useState("kasimedu");
  const [toId, setToId] = useState("mylapore");
  const [reefer, setReefer] = useState(false);
  const [setpoint, setSetpoint] = useState(4);

  const heatwave = scenarioOffsetC > 0;

  const dispatchCustom = () =>
    dispatch({
      produce,
      fromId,
      toId,
      transportSetpointC: reefer ? setpoint : null,
    });

  return (
    <div className="absolute left-4 top-4 z-10 max-h-[calc(100vh-7rem)] w-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/85 p-3 backdrop-blur">
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
            onClick={() => dispatch(d.opts)}
            className="block w-full rounded bg-slate-800 px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowCustom((v) => !v)}
        className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sky-400 hover:text-sky-300"
        aria-expanded={showCustom}
      >
        {showCustom ? "▾ Custom dispatch" : "▸ Custom dispatch"}
      </button>

      {showCustom && (
        <div className="mt-1.5 space-y-1.5 rounded bg-slate-900/70 p-2">
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
                {DESTINATIONS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={reefer}
              onChange={(e) => setReefer(e.target.checked)}
              className="accent-sky-400"
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
                  className="w-24 accent-sky-400"
                  aria-label="Reefer setpoint °C"
                />
                <span className="w-8 font-mono text-slate-200">{setpoint}°</span>
              </span>
            </label>
          )}

          <button onClick={dispatchCustom} className={`${btn(false)} w-full bg-sky-600 text-white hover:bg-sky-500`}>
            Dispatch
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setScenarioOffsetC(heatwave ? 0 : 6)} className={btn(heatwave)} aria-pressed={heatwave}>
          {heatwave ? "🔥 Heatwave ON" : "Heatwave OFF"}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={clearDelivered} className="text-xs text-slate-400 transition hover:text-slate-100">
            Clear done
          </button>
          <button onClick={resetSim} className="text-xs text-slate-400 transition hover:text-slate-100">
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
