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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-800 bg-slate-950/60 px-5 py-2">
      <Kpi label="Clock" value={formatHour(hourOfDay)} />
      <Kpi label="In transit" value={String(m.inTransit)} accent="text-sky-400" />
      <Kpi label="Delivered" value={String(m.delivered)} />
      <Kpi label="Spoiled" value={String(m.spoiled)} accent={m.spoiled > 0 ? "text-red-400" : undefined} />
      <Kpi label="Food saved" value={m.foodSavedPct == null ? "—" : `${m.foodSavedPct.toFixed(0)}%`} accent="text-emerald-400" />
      <Kpi label="CO₂" value={`${m.co2Kg.toFixed(1)} kg`} />
      <Kpi label="Cost" value={`₹${m.costRupees.toFixed(0)}`} />
      <Kpi label="Reputation" value={`${m.reputation.toFixed(0)}`} accent={repColor(m.reputation)} />
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent ?? "text-slate-100"}`}>{value}</span>
    </div>
  );
}
