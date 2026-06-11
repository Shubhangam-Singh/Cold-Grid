"use client";

/**
 * The OPERATE phase: the operator configures each delivery (send? refrigerated?
 * at what setpoint?) while a live PROJECTED outcome — food saved, energy vs the
 * generator budget, CO₂, projected stars — recomputes from the pure engine on
 * every change. "Run the day" animates the same plan on the twin map.
 */

import { useMemo } from "react";
import { getScenario } from "@/lib/academy/scenarios";
import { simulateScenario } from "@/lib/academy/run";
import { scoreScenario } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import { getNode } from "@/lib/city/chennai";
import { getProduce } from "@/lib/engine/produce";
import Stars from "./Stars";

export default function OperatorConsole() {
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const decisions = useAcademyStore((s) => s.decisions);
  const setDecision = useAcademyStore((s) => s.setDecision);
  const runDay = useAcademyStore((s) => s.runDay);
  const backToSelect = useAcademyStore((s) => s.backToSelect);

  const scenario = scenarioId ? getScenario(scenarioId) : null;

  const projected = useMemo(() => {
    if (!scenario) return null;
    const run = simulateScenario(scenario, Object.values(decisions));
    return scoreScenario(scenario, run.results);
  }, [scenario, decisions]);

  if (!scenario || !projected) return null;

  const budget = scenario.energyBudgetKwh;
  const energyPct = Math.min(100, (projected.energyKwh / budget) * 100);

  return (
    <>
      {/* Left: deliveries + controls */}
      <div className="absolute left-4 top-4 z-10 max-h-[calc(100vh-7rem)] w-80 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/90 p-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-400">
            Scenario {scenario.index} · Operate
          </span>
          <button onClick={backToSelect} className="text-[11px] text-slate-500 hover:text-slate-300">
            exit
          </button>
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-100">{scenario.title}</h2>

        <div className="mt-3 space-y-2">
          {scenario.requiredDeliveries.map((d) => {
            const dec = decisions[d.id];
            if (!dec) return null;
            return (
              <div key={d.id} className="rounded-lg bg-slate-900/70 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    {getProduce(d.produce).label}
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={dec.dispatched}
                      onChange={(e) => setDecision(d.id, { dispatched: e.target.checked })}
                      className="accent-sky-400"
                    />
                    send
                  </label>
                </div>
                <div className="font-mono text-[10px] text-slate-500">
                  {getNode(d.fromId).name} → {getNode(d.toId).name}
                </div>

                {dec.dispatched && (
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={dec.reefer}
                        onChange={(e) => setDecision(d.id, { reefer: e.target.checked })}
                        className="accent-sky-400"
                      />
                      ❄ reefer
                    </label>
                    {dec.reefer && (
                      <label className="flex flex-1 items-center gap-2 text-[11px] text-slate-400">
                        <input
                          type="range"
                          min={0}
                          max={12}
                          step={1}
                          value={dec.setpointC}
                          onChange={(e) => setDecision(d.id, { setpointC: Number(e.target.value) })}
                          className="flex-1 accent-sky-400"
                          aria-label={`${d.label} setpoint °C`}
                        />
                        <span className="w-8 font-mono text-slate-200">{dec.setpointC}°</span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={runDay}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
        >
          ▶ Run the day
        </button>
      </div>

      {/* Right: live projected outcome */}
      <div className="absolute right-4 top-4 z-10 w-64 rounded-lg border border-slate-800 bg-slate-950/90 p-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Projected
          </span>
          <Stars value={projected.stars} size="text-sm" />
        </div>

        <Metric label="Food saved" value={`${projected.foodSavedPct.toFixed(0)}%`} accent="text-emerald-400" />
        <Metric label="On-time" value={`${projected.onTimePct.toFixed(0)}%`} />
        <Metric label="CO₂" value={`${projected.co2Kg.toFixed(1)} kg`} />
        <Metric label="Cost" value={`₹${projected.costRupees.toFixed(0)}`} />

        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Generator energy</span>
            <span className={`font-mono ${projected.overBudget ? "text-red-400" : "text-slate-200"}`}>
              {projected.energyKwh.toFixed(1)}/{budget === Infinity ? "∞" : budget} kWh
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
            <div
              className={`h-full rounded ${projected.overBudget ? "bg-red-500" : "bg-sky-500"}`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
          {projected.overBudget && (
            <div className="mt-1 text-[10px] text-red-400">Over budget — generator can&apos;t keep up.</div>
          )}
        </div>

        <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] leading-snug text-slate-500">
          Tweak the plan and watch this update. Press <span className="text-slate-300">Run the day</span> when ready.
        </p>
      </div>
    </>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="mt-1.5 flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono font-semibold ${accent ?? "text-slate-200"}`}>{value}</span>
    </div>
  );
}
