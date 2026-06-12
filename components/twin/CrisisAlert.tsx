"use client";

/**
 * CrisisAlert — a dramatic, pulsing glassmorphism alert that slides in from
 * the top when a mid-transit crisis fires. Shows the crisis type, affected
 * shipment, and response option buttons. Fully animated with CSS transitions.
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";
import { getNode } from "@/lib/city/chennai";

export default function CrisisAlert() {
  const activeCrises = useColdgridStore((s) => s.sim.activeCrises);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const resolve = useColdgridStore((s) => s.resolveCrisis);

  // Show only unresolved crises
  const unresolvedCrises = activeCrises.filter((c) => !c.resolved);
  if (unresolvedCrises.length === 0) return null;

  return (
    <div className="absolute top-20 left-1/2 z-40 -translate-x-1/2 flex flex-col gap-3 w-[420px]">
      {unresolvedCrises.map((crisis) => {
        const shipment = shipments.find((s) => s.id === crisis.shipmentId);
        if (!shipment) return null;

        const produce = getProduce(shipment.produce);
        const dest = getNode(shipment.destinationId);

        const borderColor = crisis.type === "reefer_breakdown"
          ? "border-cyan-400/60"
          : crisis.type === "road_accident"
          ? "border-orange-400/60"
          : "border-red-400/60";

        const glowColor = crisis.type === "reefer_breakdown"
          ? "shadow-[0_0_30px_rgba(34,211,238,0.3)]"
          : crisis.type === "road_accident"
          ? "shadow-[0_0_30px_rgba(251,146,60,0.3)]"
          : "shadow-[0_0_30px_rgba(248,113,113,0.3)]";

        const iconPulse = crisis.type === "reefer_breakdown"
          ? "animate-pulse text-cyan-400"
          : crisis.type === "road_accident"
          ? "animate-pulse text-orange-400"
          : "animate-pulse text-red-400";

        return (
          <div
            key={crisis.id}
            className={[
              "relative overflow-hidden rounded-xl border-2 glass-panel p-4 animate-slide-down",
              borderColor,
              glowColor,
            ].join(" ")}
          >
            {/* Top accent line */}
            <div className={`absolute top-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent ${
              crisis.type === "reefer_breakdown" ? "via-cyan-400/80" :
              crisis.type === "road_accident" ? "via-orange-400/80" : "via-red-400/80"
            } to-transparent`} />

            {/* Header */}
            <div className="flex items-center gap-3">
              <span className={`text-2xl ${iconPulse}`}>{crisis.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]">
                  {crisis.title}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {produce.label} → {dest.name} · Shipment {shipment.id}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-red-400">
                  ALERT
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {crisis.description}
            </p>

            {/* Quality indicator */}
            <div className="mt-2 flex items-center gap-2 text-[10px]">
              <span className="text-slate-500">Cargo quality:</span>
              <span className={`font-mono font-bold ${
                shipment.batch.quality > 60 ? "text-green-400" :
                shipment.batch.quality > 30 ? "text-yellow-400" : "text-red-400"
              }`}>
                {shipment.batch.quality.toFixed(0)}%
              </span>
              <span className="text-slate-600">and dropping</span>
            </div>

            {/* Response Options */}
            <div className="mt-3 flex gap-2">
              {crisis.options.map((option) => {
                const isWait = option.id === "wait";
                const isPush = option.id === "push";
                const isReroute = option.id === "reroute";
                const isAmbient = option.id === "ambient";

                let btnStyle = "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-slate-400";
                if (isWait) btnStyle = "border-yellow-500/50 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20";
                if (isPush) btnStyle = "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20";
                if (isReroute) btnStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20";
                if (isAmbient) btnStyle = "border-orange-500/50 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20";

                return (
                  <button
                    key={option.id}
                    onClick={() => resolve(crisis.id, option.id)}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-left transition-all duration-200 hover:scale-[1.02]",
                      btnStyle,
                    ].join(" ")}
                    title={option.description}
                  >
                    <div className="text-[11px] font-semibold">{option.label}</div>
                    <div className="mt-0.5 text-[9px] text-slate-500 line-clamp-2">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
