"use client";

/**
 * Bottom-left live tracking stack. One card per in-transit truck; the latest
 * sits above the older ones. Each card can be minimized to a chip — all trucks
 * stay visible until they deliver.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useColdgridStore } from "@/store/coldgridStore";
import type { Shipment } from "@/lib/engine/simulation";
import { getProduce } from "@/lib/engine/produce";
import { getDriver } from "@/lib/engine/drivers";
import { getNode, getEdge } from "@/lib/city/chennai";
import { ppscUnitId } from "@/lib/hardware/ppsc";
import { useFleetCart } from "@/components/hardware/useFleetCart";
import { recommendSellPrice } from "@/lib/engine/pricing";
import { qualityToRgb, rgbCss } from "./colors";
import CargoHealth from "./CargoHealth";

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
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);
  const [minimizedIds, setMinimizedIds] = useState<Set<string>>(() => new Set());
  const prevNewestRef = useRef<string | null>(null);

  const inTransit = useMemo(
    () => shipments.filter((s) => s.status === "in-transit"),
    [shipments]
  );
  const newestId = inTransit[inTransit.length - 1]?.id ?? null;
  const transitKey = inTransit.map((s) => s.id).join(",");

  useEffect(() => {
    if (!newestId) {
      prevNewestRef.current = null;
      return;
    }
    if (newestId === prevNewestRef.current) return;
    prevNewestRef.current = newestId;
    const ids = transitKey.split(",").filter(Boolean);
    setMinimizedIds(() => {
      const next = new Set<string>();
      for (const id of ids) {
        if (id !== newestId) next.add(id);
      }
      return next;
    });
  }, [newestId, transitKey]);

  if (inTransit.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 z-20 flex max-h-[70vh] w-96 max-w-[calc(100vw-1.5rem)] flex-col-reverse gap-2 overflow-y-auto p-3 pointer-events-none">
      <AnimatePresence>
        {inTransit.map((s) => (
          <TruckTrackPanel
            key={s.id}
            shipment={s}
            minimized={minimizedIds.has(s.id)}
            onMinimize={() =>
              setMinimizedIds((prev) => {
                const next = new Set(prev);
                next.add(s.id);
                return next;
              })
            }
            onExpand={() => {
              setSelectedShipment(s.id);
              setMinimizedIds((prev) => {
                const next = new Set(prev);
                next.delete(s.id);
                return next;
              });
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function TruckTrackPanel({
  shipment,
  minimized,
  onMinimize,
  onExpand,
}: {
  shipment: Shipment;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
}) {
  const cart = useFleetCart(shipment.id);
  const produce = getProduce(shipment.produce);
  const driver = getDriver(shipment.driverId);
  const origin = getNode(shipment.originId);
  const dest = getNode(shipment.destinationId);
  const tempC = cart?.tempC ?? shipment.lastTempC;
  const rh = cart?.rh ?? shipment.lastRH;
  const voc = cart?.voc ?? shipment.lastVOC;
  const q = cart?.quality ?? shipment.batch.quality;
  const viewBatch = cart?.batch ?? shipment.batch;
  const qColor = rgbCss(qualityToRgb(q));
  const emoji = PRODUCE_EMOJI[shipment.produce] ?? "📦";
  const qualityBarColor = q > 70 ? "#22c55e" : q > 40 ? "#f59e0b" : "#ef4444";
  const unit = ppscUnitId(shipment.id);
  const quote = recommendSellPrice({ produce: shipment.produce, qualityPct: q });
  const sellMark = useColdgridStore((s) => s.sellMarks[shipment.id]);
  const transportBadge =
    shipment.transportSetpointC != null
      ? `❄ Reefer ${shipment.transportSetpointC}°C`
      : "🚚 Ambient";

  const etaMinutes = (() => {
    let totalMin = 0;
    for (let i = shipment.legIndex; i < shipment.route.length; i++) {
      const edge = getEdge(shipment.route[i]);
      const legFraction = i === shipment.legIndex ? 1 - shipment.legProgress : 1;
      totalMin += edge.travelTimeMin * legFraction;
    }
    return Math.max(1, Math.round(totalMin / driver.speedMultiplier));
  })();

  const currentSpeedKmh = (() => {
    if (shipment.route.length === 0) return 0;
    const edge = getEdge(shipment.route[shipment.legIndex]);
    const baseKmh = edge.distanceKm / (edge.travelTimeMin / 60);
    return Math.round(baseKmh * driver.speedMultiplier);
  })();

  if (minimized) {
    return (
      <motion.button
        type="button"
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={onExpand}
        aria-expanded={false}
        aria-label={`Expand ${unit}`}
        className="pointer-events-auto flex w-full items-center gap-2 rounded-full border border-sky-400/25 bg-slate-950/90 px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-sky-400/50 hover:bg-slate-900"
      >
        <span className="live-dot shrink-0" />
        <span className="text-sm leading-none">{emoji}</span>
        <span className="min-w-0 flex-1 truncate text-left font-mono text-[10px] text-slate-200">
          {produce.label} · {unit}
        </span>
        <span className="font-mono text-[10px] font-semibold" style={{ color: qualityBarColor }}>
          {q.toFixed(0)}%
        </span>
        <span className="font-mono text-[10px] text-twin-amber">₹{quote.recommendedRs}</span>
        <span className="font-mono text-[9px] text-slate-500">▴</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-sky-400/20 shadow-[0_-8px_40px_rgba(0,0,0,0.6)]"
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1a1a2e 100%)",
      }}
    >
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-xl">{emoji}</span>
              <span className="truncate text-sm font-semibold text-white">
                {produce.label} · {unit}
              </span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">
              {origin.name} → {dest.name}
            </div>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full border border-red-800/50 bg-red-950/60 px-2.5 py-1">
              <span className="live-dot" />
              <span className="text-[10px] font-bold tracking-wider text-red-400">
                {cart ? "CART" : "LIVE"}
              </span>
            </div>
            <button
              type="button"
              onClick={onMinimize}
              aria-label={`Minimize ${unit}`}
              className="rounded-md border border-slate-700/70 bg-slate-800/70 px-2 py-1 font-mono text-[10px] text-slate-400 transition hover:border-slate-500 hover:text-white"
            >
              ▾
            </button>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">ETA</div>
            <div className="font-mono text-base font-bold leading-tight text-sky-400">{etaMinutes} min</div>
          </div>
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Speed</div>
            <div className="font-mono text-base font-bold leading-tight text-slate-200">{currentSpeedKmh} km/h</div>
          </div>
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">PPSC °C</div>
            <div className="font-mono text-base font-bold leading-tight" style={{ color: qColor }}>
              {tempC.toFixed(1)}°
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Humidity</div>
            <div className="font-mono text-base font-bold leading-tight text-slate-200">
              {rh.toFixed(0)}%
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">VOC</div>
            <div className="font-mono text-base font-bold leading-tight text-slate-200">
              {voc.toFixed(0)}
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-slate-800/60 p-2 text-center">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">GPS</div>
            <div className="font-mono text-[10px] font-bold leading-tight text-slate-200">
              {shipment.position[1].toFixed(3)}, {shipment.position[0].toFixed(3)}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Cargo Quality</span>
            <span className="font-mono text-xs font-semibold" style={{ color: qualityBarColor }}>
              {q.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
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

        <div className="mb-3">
          <CargoHealth
            produce={shipment.produce}
            batch={viewBatch}
            T_C={tempC}
            RH={rh}
            VOC={voc}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{driver.avatar}</span>
            <span className="text-xs text-slate-400">
              {driver.name} · <span className="text-slate-500">{driver.title}</span>
            </span>
          </div>
          <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-500">
            {sellMark ? `Sell ₹${sellMark.rupees}` : transportBadge}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
