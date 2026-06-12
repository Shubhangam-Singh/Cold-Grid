"use client";

/**
 * TrackingCard — Uber-style live delivery tracking card.
 * Anchored to the bottom-left of the map above the legend.
 * Shows produce, route, ETA countdown, quality bar, speed, and LIVE badge.
 * Reads purely from Zustand — no parallel state (constraint 18).
 * All hooks are called unconditionally at top-level.
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useColdgridStore } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";
import { getDriver } from "@/lib/engine/drivers";
import { getNode, getEdge } from "@/lib/city/chennai";
import { qualityToRgb, rgbCss } from "./colors";

const PRODUCE_EMOJI: Record<string, string> = {
  fish: "🐟",
  milk: "🥛",
  paneer: "🧀",
  vegetables: "🥬",
  "leafy-vegetables": "🥦",
  tomato: "🍅",
  mango: "🥭",
  banana: "🍌",
  "ice-cream": "🍦",
  vaccine: "💉",
};

export default function TrackingCard() {
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const selectedId = useColdgridStore((s) => s.selectedShipmentId);
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);

  const inTransit = useMemo(
    () => shipments.filter((s) => s.status === "in-transit"),
    [shipments]
  );

  // Show selected truck's card, or first truck if none selected — all hooks MUST be above any return
  const shipment = useMemo(() => {
    if (inTransit.length === 0) return null;
    return inTransit.find((s) => s.id === selectedId) ?? inTransit[0];
  }, [inTransit, selectedId]);

  // ETA: sum remaining travel time — safe even when shipment is null (returns 0)
  const etaMinutes = useMemo(() => {
    if (!shipment) return 0;
    const driver = getDriver(shipment.driverId);
    let totalMin = 0;
    for (let i = shipment.legIndex; i < shipment.route.length; i++) {
      const edge = getEdge(shipment.route[i]);
      const legFraction = i === shipment.legIndex ? 1 - shipment.legProgress : 1;
      totalMin += edge.travelTimeMin * legFraction;
    }
    return Math.max(1, Math.round(totalMin / driver.speedMultiplier));
  }, [shipment]);

  // Simulated speed in km/h for the current leg
  const currentSpeedKmh = useMemo(() => {
    if (!shipment || shipment.route.length === 0) return 0;
    const driver = getDriver(shipment.driverId);
    const edge = getEdge(shipment.route[shipment.legIndex]);
    const baseKmh = edge.distanceKm / (edge.travelTimeMin / 60);
    return Math.round(baseKmh * driver.speedMultiplier);
  }, [shipment]);

  // Gate render here — after all hooks
  if (!shipment) return null;

  const produce = getProduce(shipment.produce);
  const driver = getDriver(shipment.driverId);
  const origin = getNode(shipment.originId);
  const dest = getNode(shipment.destinationId);
  const q = shipment.batch.quality;
  const qColor = rgbCss(qualityToRgb(q));
  const emoji = PRODUCE_EMOJI[shipment.produce] ?? "📦";
  const qualityBarColor = q > 70 ? "#22c55e" : q > 40 ? "#f59e0b" : "#ef4444";
  const transportBadge =
    shipment.transportSetpointC != null
      ? `❄ Reefer ${shipment.transportSetpointC}°C`
      : "🚚 Ambient";

  return (
    <AnimatePresence>
      <motion.div
        key={shipment.id}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 z-20 w-80 pointer-events-auto"
        style={{
          background: "linear-gradient(180deg, #0f172a 0%, #1a1a2e 100%)",
          borderRadius: "16px 16px 0 0",
          border: "1px solid rgba(56,189,248,0.2)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(56,189,248,0.08)",
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(56,189,248,0.6), transparent)",
          }}
        />

        <div className="p-4 pb-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xl">{emoji}</span>
                <span className="text-sm font-semibold text-white truncate">
                  {produce.label} Shipment
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                {origin.name} → {dest.name}
              </div>
            </div>

            {/* LIVE badge */}
            <div className="flex items-center gap-1.5 shrink-0 ml-3 bg-red-950/60 border border-red-800/50 rounded-full px-2.5 py-1">
              <span className="live-dot" />
              <span className="text-[10px] font-bold text-red-400 tracking-wider">LIVE</span>
            </div>
          </div>

          {/* ETA + Speed + Temp row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 bg-slate-800/60 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">ETA</div>
              <div className="text-base font-bold text-sky-400 font-mono leading-tight">
                {etaMinutes} min
              </div>
            </div>
            <div className="flex-1 bg-slate-800/60 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">Speed</div>
              <div className="text-base font-bold text-slate-200 font-mono leading-tight">
                {currentSpeedKmh} km/h
              </div>
            </div>
            <div className="flex-1 bg-slate-800/60 rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">Cargo °C</div>
              <div
                className="text-base font-bold font-mono leading-tight"
                style={{ color: qColor }}
              >
                {shipment.lastTempC.toFixed(0)}°
              </div>
            </div>
          </div>

          {/* Quality bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Cargo Quality
              </span>
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: qualityBarColor }}
              >
                {q.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="quality-bar-fill h-full rounded-full"
                style={{
                  width: `${Math.max(0, q)}%`,
                  backgroundColor: qualityBarColor,
                  boxShadow: `0 0 6px ${qualityBarColor}80`,
                }}
              />
            </div>
          </div>

          {/* Driver + transport */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{driver.avatar}</span>
              <span className="text-xs text-slate-400">
                {driver.name} ·{" "}
                <span className="text-slate-500">{driver.title}</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
              {transportBadge}
            </span>
          </div>

          {/* Multi-truck selector dots */}
          {inTransit.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {inTransit.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedShipment(s.id)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    s.id === (selectedId ?? inTransit[0].id)
                      ? "bg-sky-400 scale-125"
                      : "bg-slate-600 hover:bg-slate-500"
                  }`}
                  title={`${getProduce(s.produce).label} truck`}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
