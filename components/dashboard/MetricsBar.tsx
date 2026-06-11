"use client";

/**
 * Dashboard strip (spec §8): live fleet KPIs — city clock, in-transit/delivered
 * counts, food saved, CO₂, cost, reputation — in mono control-room style.
 */

import { useMemo } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { fleetMetrics } from "@/lib/academy/metrics";

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function repColor(r: number): string {
  if (r >= 80) return "text-emerald-400";
  if (r >= 55) return "text-amber-400";
  return "text-red-400";
}

export default function MetricsBar() {
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const hourOfDay = useColdgridStore((s) => s.sim.hourOfDay);
  const m = useMemo(() => fleetMetrics(shipments), [shipments]);

  return (
    <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 bg-gradient-to-b from-slate-900/60 to-transparent px-5 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm border-b border-white/5">
      <Kpi label="Clock" value={formatHour(hourOfDay)} icon="⏱" />
      <Kpi label="In transit" value={String(m.inTransit)} accent="text-twin-cyan text-glow" icon="🚚" />
      <Kpi label="Delivered" value={String(m.delivered)} icon="📦" />
      <Kpi label="Spoiled" value={String(m.spoiled)} accent={m.spoiled > 0 ? "text-twin-danger text-glow animate-pulse-slow" : undefined} icon="⚠️" />
      <Kpi label="Food saved" value={m.foodSavedPct == null ? "—" : `${m.foodSavedPct.toFixed(0)}%`} accent="text-twin-emerald text-glow" icon="🌱" />
      <Kpi label="CO₂" value={`${m.co2Kg.toFixed(1)} kg`} icon="💨" />
      <Kpi label="Cost" value={`₹${m.costRupees.toFixed(0)}`} icon="💰" />
      <Kpi label="Reputation" value={`${m.reputation.toFixed(0)}`} accent={repColor(m.reputation) + " text-glow"} icon="⭐" />
    </div>
  );
}

function Kpi({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: string }) {
  return (
    <div className="glass-pill flex items-center gap-2 px-3 py-1.5 transition-transform duration-300 hover:scale-105 hover:bg-slate-800/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]">
      {icon && <span className="text-xs opacity-70">{icon}</span>}
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-400">{label}</span>
      <span className={`font-mono text-sm font-bold ${accent ?? "text-white"}`}>{value}</span>
    </div>
  );
}
