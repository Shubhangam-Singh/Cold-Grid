"use client";

import { createPortal } from "react-dom";
import { useMemo, useState, useEffect } from "react";
import { getScenario } from "@/lib/academy/scenarios";
import { simulateScenario } from "@/lib/academy/run";
import { scoreScenario } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import { DRIVERS } from "@/lib/engine/drivers";
import { RouteStrategy } from "@/lib/city/chennai";

export default function ComparatorModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Strategy A is the current operator decisions
  // Strategy B will be configured in the modal
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const decisions = useAcademyStore((s) => s.decisions);
  const scenario = scenarioId ? getScenario(scenarioId) : null;

  // We need to keep a local state for Strategy B
  const [strategyB, setStrategyB] = useState<typeof decisions | null>(null);

  // Initialize Strategy B with current decisions when opening
  const handleOpen = () => {
    setStrategyB(JSON.parse(JSON.stringify(decisions)));
    setIsOpen(true);
  };

  const scoreA = useMemo(() => {
    if (!scenario) return null;
    return scoreScenario(scenario, simulateScenario(scenario, Object.values(decisions)).results);
  }, [scenario, decisions]);

  const scoreB = useMemo(() => {
    if (!scenario || !strategyB) return null;
    return scoreScenario(scenario, simulateScenario(scenario, Object.values(strategyB)).results);
  }, [scenario, strategyB]);

  const usedDriverIdsB = strategyB ? Object.values(strategyB)
    .filter((dec) => dec.dispatched)
    .map((dec) => dec.driverId) : [];

  if (!scenario || !scoreA) return null;

  return (
    <>
      <button 
        onClick={handleOpen}
        className="mt-2 w-full rounded-lg bg-indigo-500/20 border border-indigo-500/50 px-4 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-500/30"
      >
        ⚖️ Compare Strategies
      </button>

      {mounted && isOpen && strategyB && scoreB && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl glass-panel p-5 sm:p-8 shadow-2xl flex flex-col relative">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-xs uppercase"
            >
              Close
            </button>
            
            <h2 className="text-2xl font-bold text-white mb-6">What-If Strategy Comparator</h2>

            <div className="flex gap-8">
              {/* Strategy A (Current) */}
              <div className="flex-1 border border-slate-700/50 bg-slate-900/50 rounded-xl p-4">
                <h3 className="text-sm font-mono uppercase tracking-widest text-emerald-400 mb-4">Strategy A (Current)</h3>
                <div className="space-y-4 mb-6 text-sm text-slate-300">
                  {Object.values(decisions).map(d => (
                    <div key={d.deliveryId} className="bg-slate-800/50 p-2 rounded">
                      <div className="font-semibold">{d.deliveryId}</div>
                      <div className="text-xs text-slate-400">
                        {d.dispatched ? `Driver: ${d.driverId} | Route: ${d.routeStrategy} | ${d.reefer ? `Reefer ${d.setpointC}°C` : 'Ambient'}` : 'Not Sent'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategy B (Alternative) */}
              <div className="flex-1 border border-indigo-500/30 bg-indigo-900/20 rounded-xl p-4">
                <h3 className="text-sm font-mono uppercase tracking-widest text-indigo-400 mb-4">Strategy B (Alternative)</h3>
                <div className="space-y-4 mb-6 text-sm text-slate-300">
                  {Object.values(strategyB).map(d => (
                    <div key={d.deliveryId} className="bg-slate-800/50 p-2 rounded flex flex-col gap-2">
                      <div className="font-semibold flex justify-between">
                        <span>{d.deliveryId}</span>
                        <label className="text-xs flex items-center gap-1">
                          <input 
                            type="checkbox" 
                            checked={d.reefer} 
                            onChange={(e) => setStrategyB({...strategyB, [d.deliveryId]: {...d, reefer: e.target.checked}})} 
                          /> Reefer
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 bg-slate-950 border border-slate-700 text-xs p-1 rounded"
                          value={d.driverId}
                          onChange={(e) => setStrategyB({...strategyB, [d.deliveryId]: {...d, driverId: e.target.value}})}
                        >
                          {DRIVERS.map(dr => {
                            const isUsed = usedDriverIdsB.includes(dr.id) && d.driverId !== dr.id;
                            return (
                              <option key={dr.id} value={dr.id} disabled={isUsed}>
                                {dr.name} {isUsed ? "(Busy)" : ""}
                              </option>
                            );
                          })}
                        </select>
                        <select 
                          className="flex-1 bg-slate-950 border border-slate-700 text-xs p-1 rounded"
                          value={d.routeStrategy}
                          onChange={(e) => setStrategyB({...strategyB, [d.deliveryId]: {...d, routeStrategy: e.target.value as RouteStrategy}})}
                        >
                          <option value="fastest">Fastest</option>
                          <option value="shortest">Shortest</option>
                          <option value="coolest">Coolest</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Chart */}
            <div className="mt-8 border-t border-slate-700 pt-6">
              <h3 className="text-center font-mono text-xs uppercase tracking-[0.2em] text-slate-500 mb-4">Outcome Comparison</h3>
              
              <div className="space-y-4">
                <ComparisonBar label="Food Saved" valA={scoreA.foodSavedPct} valB={scoreB.foodSavedPct} unit="%" higherIsBetter={true} />
                <ComparisonBar label="CO₂ Emissions" valA={scoreA.co2Kg} valB={scoreB.co2Kg} unit=" kg" higherIsBetter={false} />
                <ComparisonBar label="Energy Consumed" valA={scoreA.energyKwh} valB={scoreB.energyKwh} unit=" kWh" higherIsBetter={false} />
                <ComparisonBar label="Cost" valA={scoreA.costRupees} valB={scoreB.costRupees} unit=" ₹" higherIsBetter={false} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function ComparisonBar({ label, valA, valB, unit, higherIsBetter }: { label: string, valA: number, valB: number, unit: string, higherIsBetter: boolean }) {
  const max = Math.max(valA, valB, 1); // Avoid div by 0
  const pctA = (valA / max) * 100;
  const pctB = (valB / max) * 100;

  let colorA = "bg-emerald-500";
  let colorB = "bg-indigo-500";

  if (valA !== valB) {
    if ((valA > valB && higherIsBetter) || (valA < valB && !higherIsBetter)) {
      colorA = "bg-emerald-500";
      colorB = "bg-slate-600";
    } else {
      colorA = "bg-slate-600";
      colorB = "bg-indigo-500";
    }
  }

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-16 text-right font-mono text-xs text-emerald-400">{valA.toFixed(1)}{unit}</div>
        <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden flex">
          <div className={`h-full ${colorA} transition-all`} style={{ width: `${pctA}%` }} />
        </div>
        <div className="w-8 text-center text-slate-500 text-[10px]">VS</div>
        <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden flex justify-end">
          <div className={`h-full ${colorB} transition-all`} style={{ width: `${pctB}%` }} />
        </div>
        <div className="w-16 text-left font-mono text-xs text-indigo-400">{valB.toFixed(1)}{unit}</div>
      </div>
    </div>
  );
}
