"use client";

/**
 * DecisionDialog — the reusable mid-transit crisis decision sheet.
 *
 * - Slides up from bottom-center of the map via framer-motion
 * - Shows crisis icon, title, severity badge, situation text
 * - Physics preview: calls predictedShelfLifeHours() per option — real engine output
 * - 0.8s confirmation animation on option select
 * - Queue indicator: "X more crisis pending"
 * - DO NOT hardcode quality numbers — all predictions from spoilage engine
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useColdgridStore } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";
import { getDriver } from "@/lib/engine/drivers";
import { predictedShelfLifeHours } from "@/lib/engine/spoilage";
import { getNode, cityAmbientC, edgeAmbientC, getEdge } from "@/lib/city/chennai";
import type { CrisisOption } from "@/lib/engine/crisisEvents";
import type { Shipment } from "@/lib/engine/simulation";

// ─────────────────────────────────────────────────────────────────────────────
// Types & config
// ─────────────────────────────────────────────────────────────────────────────

type Severity = "CRITICAL" | "WARNING" | "INFO";

const CRISIS_SEVERITY: Record<string, Severity> = {
  tire_blowout: "WARNING",
  road_accident: "CRITICAL",
  reefer_breakdown: "CRITICAL",
};

const SEVERITY_STYLE: Record<Severity, { bg: string; text: string; border: string; glow: string }> = {
  CRITICAL: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/50",
    glow: "shadow-[0_0_40px_rgba(239,68,68,0.25)]",
  },
  WARNING: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/50",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.25)]",
  },
  INFO: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/50",
    glow: "shadow-[0_0_40px_rgba(14,165,233,0.25)]",
  },
};

const OPTION_ACCENT: Record<string, string> = {
  wait: "border-amber-500/40 bg-amber-500/8 hover:bg-amber-500/15 text-amber-200",
  push: "border-red-500/40 bg-red-500/8 hover:bg-red-500/15 text-red-200",
  reroute: "border-emerald-500/40 bg-emerald-500/8 hover:bg-emerald-500/15 text-emerald-200",
  ambient: "border-orange-500/40 bg-orange-500/8 hover:bg-orange-500/15 text-orange-200",
  // ❄️ Hub diversion — distinct ice-blue to signal "safe haven"
  divert_hub: "border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/30",
  // 🍳 Kitchen diversion — orange
  divert_kitchen: "border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/30",
};

// ─────────────────────────────────────────────────────────────────────────────
// Quality prediction helpers (calls engine — no hardcoded values)
// ─────────────────────────────────────────────────────────────name──────────────

function computeOptionPreview(
  option: CrisisOption,
  shipment: Shipment,
  ambientC: number,
  currentQuality: number,
): { qualityOnArrival: number; timePenaltyMin: number; co2Delta: string } {
  const profile = getProduce(shipment.produce);

  let timePenaltyMin = 0;
  let tempForPrediction = shipment.transportSetpointC ?? ambientC;
  let speedMultiplier = 1.0;

  switch (option.effect.type) {
    case "wait":
      timePenaltyMin = option.effect.delayMinutes;
      // During wait: cargo sits at current transport temperature (reefer off if breakdown)
      break;
    case "reefer_off":
      // Cargo now warms to ambient
      tempForPrediction = ambientC;
      break;
    case "push_through":
      speedMultiplier = option.effect.speedPenalty;
      if (option.effect.speedPenalty >= 1.2) {
        tempForPrediction = ambientC; // sprinting = no reefer
      }
      break;
    case "reroute":
      timePenaltyMin = 8; // estimated reroute overhead
      break;
    case "divert_to_hub":
      // Diverting to hub: short reroute but cargo arrives at cold storage.
      // Temperature at hub is its setpoint (~5°C), so quality is preserved.
      timePenaltyMin = 12; // estimated time overhead for diversion
      // Cargo reaches hub refrigeration — approximate as reefer-on temp
      tempForPrediction = shipment.transportSetpointC ?? 5;
      break;
    case "divert_kitchen":
      timePenaltyMin = 8;
      tempForPrediction = shipment.transportSetpointC ?? ambientC;
      break;
  }

  // Predict quality: use remaining shelf life at the implied temperature
  const remainingShelfLifeH = predictedShelfLifeHours(shipment.batch, profile, tempForPrediction);
  const penaltyHours = timePenaltyMin / 60;

  // Estimate remaining transit time (rough: assume ~30 min average remaining)
  const estimatedTransitH = 0.5 / speedMultiplier + penaltyHours;

  // Quality fraction consumed by estimated remaining transit
  const qualityLoss = Math.min(100, (estimatedTransitH / remainingShelfLifeH) * currentQuality);
  const qualityOnArrival = Math.max(0, currentQuality - qualityLoss);

  // CO2 estimate
  let co2Delta = "—";
  if (option.effect.type === "push_through" && option.effect.speedPenalty > 1) {
    co2Delta = `+${((option.effect.speedPenalty - 1) * 12).toFixed(0)}%`;
  } else if (option.effect.type === "reroute") {
    co2Delta = "+~5%";
  } else if (option.effect.type === "wait") {
    co2Delta = "0% (idle)";
  }

  return { qualityOnArrival, timePenaltyMin, co2Delta };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DecisionDialog() {
  const activeCrisisId = useColdgridStore((s) => s.activeCrisisId);
  const crisisQueue = useColdgridStore((s) => s.crisisQueue);
  const sim = useColdgridStore((s) => s.sim);
  const resolve = useColdgridStore((s) => s.resolveCrisis);

  const [confirmedOptionId, setConfirmedOptionId] = useState<string | null>(null);

  const crisis = useMemo(
    () => activeCrisisId ? sim.activeCrises.find((c) => c.id === activeCrisisId) ?? null : null,
    [activeCrisisId, sim.activeCrises]
  );

  const shipment = useMemo(
    () => crisis ? sim.shipments.find((s) => s.id === crisis.shipmentId) ?? null : null,
    [crisis, sim.shipments]
  );

  if (!crisis || !shipment) return null;

  const severity = CRISIS_SEVERITY[crisis.type] ?? "WARNING";
  const style = SEVERITY_STYLE[severity];
  const dest = getNode(shipment.destinationId);
  const produce = getProduce(shipment.produce);
  const driver = getDriver(shipment.driverId);

  // Ambient temperature at current edge
  let ambientC = sim.scenarioOffsetC + 32;
  try {
    const edge = getEdge(crisis.edgeId);
    ambientC = edgeAmbientC(edge, sim.hourOfDay, sim.scenarioOffsetC);
  } catch {
    ambientC = cityAmbientC(sim.hourOfDay, sim.scenarioOffsetC);
  }

  const handleSelect = (optionId: string) => {
    setConfirmedOptionId(optionId);
    setTimeout(() => {
      resolve(crisis.id, optionId);
      setConfirmedOptionId(null);
    }, 800);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={crisis.id}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={[
          "absolute bottom-4 left-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2",
          "rounded-2xl border-2 backdrop-blur-md",
          "bg-slate-900/95",
          style.border,
          style.glow,
        ].join(" ")}
        style={{ transform: "translate(-50%, 0)" }}
      >
        {/* Top accent line */}
        <div className={`h-[2px] w-full rounded-t-2xl ${style.bg}`} />

        <div className="p-4">
          {/* ── Header ── */}
          <div className="flex items-start gap-3">
            <span className="text-3xl" style={{ lineHeight: 1 }}>{crisis.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">{crisis.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest ${style.bg} ${style.text}`}
                >
                  {severity}
                </span>
                {crisisQueue.length > 0 && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-800">
                    +{crisisQueue.length} more pending
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] font-mono text-slate-400">
                {produce.label} → {dest.name} · {shipment.id} · 🧑 {driver.name}
              </div>
            </div>
          </div>

          {/* ── Situation text ── */}
          <p className="mt-3 text-xs leading-relaxed text-slate-300 border-l-2 pl-3 border-slate-600">
            {crisis.description}
          </p>

          {/* ── Cargo status ── */}
          <div className="mt-2.5 flex items-center gap-4 text-[10px]">
            <QualityBar quality={shipment.batch.quality} />
            <span className="text-slate-500">
              Ambient: <span className="text-slate-300 font-mono">{ambientC.toFixed(1)}°C</span>
            </span>
          </div>

          {/* ── Option buttons with physics preview ── */}
          <div className="mt-3 flex flex-col gap-2">
            {crisis.options.map((option) => {
              const preview = computeOptionPreview(
                option,
                shipment,
                ambientC,
                shipment.batch.quality
              );
              const accent = OPTION_ACCENT[option.id] ?? "border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60";
              const isConfirmed = confirmedOptionId === option.id;

              return (
                <motion.button
                  key={option.id}
                  disabled={confirmedOptionId !== null}
                  onClick={() => handleSelect(option.id)}
                  animate={
                    isConfirmed
                      ? { scale: [1, 1.03, 1], backgroundColor: ["", "#10b981", ""] }
                      : {}
                  }
                  transition={{ duration: 0.4 }}
                  className={[
                    "relative w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                    accent,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold leading-tight">{option.label}</div>
                      <div className="mt-0.5 text-[9px] text-slate-500 line-clamp-2">
                        {option.description}
                      </div>
                    </div>

                    {/* Physics preview panel */}
                    <div className="flex-shrink-0 text-right space-y-0.5 border-l border-slate-700 pl-3 ml-1">
                      <div className="text-[9px] text-slate-500">~arrival quality</div>
                      <div
                        className={`font-mono text-[13px] font-bold ${
                          preview.qualityOnArrival >= 70
                            ? "text-emerald-400"
                            : preview.qualityOnArrival >= 40
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {preview.qualityOnArrival.toFixed(0)}%
                      </div>
                      {preview.timePenaltyMin > 0 && (
                        <div className="text-[8px] text-slate-500">+{preview.timePenaltyMin}min</div>
                      )}
                      {preview.co2Delta !== "—" && (
                        <div className="text-[8px] text-slate-600">CO₂ {preview.co2Delta}</div>
                      )}
                    </div>
                  </div>

                  {/* Confirmation checkmark overlay */}
                  <AnimatePresence>
                    {isConfirmed && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-500/20"
                      >
                        <span className="text-2xl">✓</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <p className="mt-2.5 text-[9px] text-slate-600 text-center">
            Quality predictions are computed by the PPSC Adaptive Arrhenius engine
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function QualityBar({ quality }: { quality: number }) {
  const color =
    quality >= 70 ? "#34d399" : quality >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500">Cargo quality:</span>
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${quality}%`, background: color }}
          />
        </div>
        <span
          className="font-mono text-[10px] font-bold"
          style={{ color }}
        >
          {quality.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
