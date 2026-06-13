"use client";

import { useMemo, useState } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { createBatch, celsiusToKelvin, baseRate } from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";

export default function FarmImpactPanel() {
  const nodes = useColdgridStore((s) => s.nodes);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const [expanded, setExpanded] = useState(true);

  const isHeatwave = scenarioOffsetC > 0;

  const { totalCapacity, tripsSaved, spoilageReductionPct } = useMemo(() => {
    let capacity = 0;
    for (const node of nodes) {
      if (node.type === "urban_farm" && node.localProductionCapacity) {
        capacity += node.localProductionCapacity;
      }
    }
    const trips = Math.floor(capacity / 1500); // approx 1500kg per small commercial truck
    // Assume 5000kg is total city demand, baseline spoilage is 8% (rough values for demonstration)
    const spoilageReduction = (capacity / 5000) * 8; 
    return {
      totalCapacity: capacity,
      tripsSaved: trips,
      spoilageReductionPct: spoilageReduction.toFixed(1)
    };
  }, [nodes]);

  const chartData = useMemo(() => {
    // Spoilage percentage comparison: 2km vs 18km at 33°C ambient
    const ambientTemp = 33;
    
    const getSpoiledPct = (produceId: "leafyVeg" | "tomato", distKm: number) => {
      const transitHours = distKm / 15; // 15 km/h avg city speed
      const batch = createBatch("temp", produceId);
      batch.ageHours = transitHours;
      const profile = getProduce(produceId);
      const T = celsiusToKelvin(ambientTemp);
      const rate = baseRate(T, profile.eaBase, profile);
      // simplified spoil amount based on rate and hours
      const pct = Math.min(100, transitHours * rate * 1.5); 
      return pct;
    };

    return [
      {
        name: "Leafy Veg",
        "Cold Chain (18km)": getSpoiledPct("leafyVeg", 18),
        "Urban Farm (2km)": getSpoiledPct("leafyVeg", 2),
      },
      {
        name: "Tomato",
        "Cold Chain (18km)": getSpoiledPct("tomato", 18),
        "Urban Farm (2km)": getSpoiledPct("tomato", 2),
      }
    ];
  }, []);

  if (!expanded) {
    return (
      <button 
        onClick={() => setExpanded(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-xl glass-panel px-4 py-3 animate-slide-up hover:bg-slate-800/80 transition-colors shadow-2xl ml-auto w-fit"
      >
        <span className="text-xl">🌱</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-300">Urban Farm Impact</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-80 rounded-xl glass-panel p-4 animate-slide-up flex flex-col gap-3 shadow-2xl ml-auto">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400 flex items-center gap-2">
          <span>🌱</span> Urban Farm Impact
        </span>
        <button 
          onClick={() => setExpanded(false)}
          className="text-slate-500 hover:text-white transition-colors"
        >
          ▾
        </button>
      </div>

      {isHeatwave && (
        <div className="rounded-md border border-twin-emerald/30 bg-twin-emerald/10 p-2 text-xs text-twin-emerald animate-pulse-slow">
          <strong>Urban farms active</strong> — T. Nagar leafy veg demand met 35% locally. Reducing cold chain stress.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-slate-700/50 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Local Cap</div>
          <div className="text-lg font-bold text-slate-200">{totalCapacity} <span className="text-xs text-slate-500 font-normal">kg</span></div>
        </div>
        <div className="rounded border border-slate-700/50 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Trips Saved</div>
          <div className="text-lg font-bold text-twin-cyan">{tripsSaved}</div>
        </div>
      </div>

      <div className="text-xs text-slate-300">
        Estimated city-wide spoilage reduced by <strong className="text-twin-emerald">{spoilageReductionPct}%</strong> as local produce travels &lt;2km vs the 18km cold chain average.
      </div>

      <div className="h-40 mt-2 mb-2">
        <div className="text-[9px] font-mono text-slate-500 uppercase text-center mb-1">Spoilage % at 33°C (2km vs 18km)</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", fontSize: "11px", color: "#e2e8f0" }} 
              itemStyle={{ color: "#e2e8f0" }}
            />
            <Legend wrapperStyle={{ fontSize: "10px", color: "#94a3b8", paddingTop: "12px", paddingBottom: "4px" }} iconSize={8} verticalAlign="bottom" />
            <Bar dataKey="Cold Chain (18km)" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Urban Farm (2km)" fill="#22c55e" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
