"use client";

/**
 * TruckMarker — Uber-style HTML/SVG delivery truck on the deck.gl map.
 *
 * Phase 9+ upgrade:
 * - Reads TruckVisualState from the store (MOVING/HALTED/AWAITING_COMMAND/…)
 * - Freezes rAF position advancement when HALTED or AWAITING_COMMAND
 * - Eases in/out: smoothing factor ramps up (ACCELERATING) or down (DECELERATING)
 * - Amber pulsing ring shown only when AWAITING_COMMAND
 * - Status badges: LIMPING / NO REEFER / CRAWLING / SPRINTING / REPAIRING
 * - Repair countdown timer shown on marker during HALTED state
 * - REROUTING: brief 180° spin animation before following new route
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WebMercatorViewport } from "@deck.gl/core";
import type { Shipment } from "@/lib/engine/simulation";
import { useColdgridStore, type TruckBadge } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";
import { getDriver } from "@/lib/engine/drivers";
import { qualityToRgb, rgbCss } from "./colors";

interface Props {
  shipment: Shipment;
  viewportRef: React.MutableRefObject<WebMercatorViewport | null>;
}

/** Exponential smoothing factor for a frame of length dt, time-constant tau. */
function smoothing(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / tau);
}

/** Badge config: text, background color, text color. */
const BADGE_CONFIG: Record<
  NonNullable<TruckBadge>,
  { label: string; bg: string; text: string; icon: string }
> = {
  LIMPING: { label: "LIMPING", bg: "#f59e0b", text: "#0f172a", icon: "🔧" },
  NO_REEFER: { label: "NO REEFER", bg: "#f97316", text: "#0f172a", icon: "❄️" },
  NO_REEFER_SPRINT: { label: "SPRINTING", bg: "#ef4444", text: "#ffffff", icon: "⚡" },
  CRAWLING: { label: "CRAWLING", bg: "#dc2626", text: "#ffffff", icon: "🐢" },
  REPAIRING: { label: "REPAIRING", bg: "#6366f1", text: "#ffffff", icon: "🔧" },
};

export default function TruckMarker({ shipment, viewportRef }: Props) {
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);
  const selected = useColdgridStore((s) => s.selectedShipmentId === shipment.id);
  const visualState = useColdgridStore((s) => s.truckStates[shipment.id]);
  // Read sim clock for the countdown timer — updates every tick
  const simClockHours = useColdgridStore((s) => s.sim.clockHours);

  const truckState = visualState?.state ?? "MOVING";
  const badge = visualState?.badge ?? null;


  // Sim-clock countdown: minutes remaining from current sim time to halt end
  const minutesRemaining =
    truckState === "HALTED" && visualState?.haltUntilClockHours != null
      ? Math.max(0, (visualState.haltUntilClockHours - simClockHours) * 60)
      : null;

  // Whether the rAF loop should freeze position advancement
  const isFrozen = truckState === "HALTED" || truckState === "AWAITING_COMMAND";
  const isRerouting = truckState === "REROUTING";

  // Latest authoritative state (cheap ref — rAF reads it every frame)
  const latest = useRef(shipment);
  latest.current = shipment;

  const frozenRef = useRef(isFrozen);
  frozenRef.current = isFrozen;

  const reroutingRef = useRef(isRerouting);
  reroutingRef.current = isRerouting;

  const truckStateRef = useRef(truckState);
  truckStateRef.current = truckState;

  const outerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const dispPos = useRef<[number, number]>([shipment.position[0], shipment.position[1]]);
  const dispAngle = useRef<number>(shipment.angle ?? 0);

  // Smoothing ramp state for acceleration/deceleration
  const tauRef = useRef<number>(0.07); // current time-constant (lower = snappier)

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sh = latest.current;
      const state = truckStateRef.current;

      // Ramp smoothing time-constant based on state
      let targetTau: number;
      switch (state) {
        case "ACCELERATING":
          targetTau = 0.12; // slower = smoother ramp-up
          break;
        case "DECELERATING":
          targetTau = 0.18; // even slower = smooth deceleration feel
          break;
        case "MOVING":
          targetTau = 0.07; // responsive tracking
          break;
        default:
          targetTau = 0.07;
      }
      // Ease the tau itself so transitions are smooth
      tauRef.current += (targetTau - tauRef.current) * 0.05;

      // If frozen, don't advance dispPos toward new engine position
      if (!frozenRef.current && !reroutingRef.current) {
        const a = smoothing(dt, tauRef.current);
        dispPos.current[0] += (sh.position[0] - dispPos.current[0]) * a;
        dispPos.current[1] += (sh.position[1] - dispPos.current[1]) * a;

        const target = sh.angle ?? dispAngle.current;
        const delta = ((target - dispAngle.current + 540) % 360) - 180;
        dispAngle.current += delta * a;
      }

      const vp = viewportRef.current;
      const outer = outerRef.current;
      if (vp && outer) {
        const [x, y] = vp.project([dispPos.current[0], dispPos.current[1]]);
        const w = vp.width;
        const h = vp.height;
        if (x < -100 || y < -100 || x > w + 100 || y > h + 100) {
          outer.style.opacity = "0";
        } else {
          outer.style.opacity = "1";
          outer.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
      }
      if (iconRef.current && !reroutingRef.current) {
        iconRef.current.style.transform = `rotate(${dispAngle.current}deg)`;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [viewportRef]);

  const profile = getProduce(shipment.produce);
  const driver = getDriver(shipment.driverId);
  const q = shipment.batch.quality;
  const qColor = rgbCss(qualityToRgb(q));

  const badgeCfg = badge ? BADGE_CONFIG[badge] : null;

  return (
    <div
      ref={outerRef}
      className="absolute left-0 top-0 will-change-transform"
      style={{ transform: "translate3d(-9999px,-9999px,0)" }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative flex flex-col items-center justify-center"
      >
        {/* ── Truck icon container ── */}
        <div className="relative flex items-center justify-center" style={{ width: 36, height: 44 }}>
          {/* Pulsing ring — amber when AWAITING_COMMAND, cyan otherwise */}
          {truckState === "AWAITING_COMMAND" ? (
            <span
              className="absolute rounded-full"
              style={{
                width: 48,
                height: 48,
                border: "2.5px solid #f59e0b",
                animation: "truckAwaitingPulse 1s ease-in-out infinite",
                opacity: 0.85,
              }}
            />
          ) : (
            <span className="truck-pulse-ring" aria-hidden />
          )}

          {/* Quality glow */}
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 30,
              height: 30,
              background: qColor,
              opacity: selected ? 0.5 : 0.32,
              filter: "blur(6px)",
            }}
          />

          {/* Truck SVG — rotates via rAF imperative; spins on REROUTING */}
          <motion.div
            ref={iconRef}
            className="relative will-change-transform"
            style={{ width: 32, height: 44 }}
            animate={
              isRerouting
                ? { rotate: [0, 180, 360], scale: [1, 0.7, 1] }
                : truckState === "EXECUTING_DECISION"
                ? { scale: [1, 1.2, 1] }
                : {}
            }
            transition={
              isRerouting
                ? { duration: 0.6, ease: "easeInOut" }
                : { duration: 0.4 }
            }
          >
            <TruckSvg
              selected={selected}
              halted={isFrozen}
              awaiting={truckState === "AWAITING_COMMAND"}
            />
          </motion.div>

          {/* Click target */}
          <button
            onClick={() => setSelectedShipment(shipment.id)}
            className="absolute -inset-1 cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
            aria-label={`${profile.label} shipment, ${q.toFixed(0)}% quality, driver ${driver.name}. Open decay curve.`}
            title={`${profile.label} · ${q.toFixed(0)}% · ${driver.name}`}
            style={{ pointerEvents: "auto" }}
          />
        </div>

        {/* ── Repair countdown (sim-clock driven) ── */}
        <AnimatePresence>
          {truckState === "HALTED" && minutesRemaining != null && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold"
              style={{ background: "#6366f1", color: "#fff", whiteSpace: "nowrap" }}
            >
              🔧 {minutesRemaining.toFixed(1)}min
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Status badge ── */}
        <AnimatePresence>
          {badgeCfg && (
            <motion.div
              key={badge}
              initial={{ opacity: 0, scale: 0.8, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{
                background: badgeCfg.bg,
                color: badgeCfg.text,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            >
              <span>{badgeCfg.icon}</span>
              <span>{badgeCfg.label}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
        @keyframes truckAwaitingPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.35); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

/** Clean top-down delivery truck, pointing UP (north) at rotation 0. */
function TruckSvg({
  selected,
  halted,
  awaiting,
}: {
  selected: boolean;
  halted: boolean;
  awaiting: boolean;
}) {
  const strokeColor = awaiting ? "#f59e0b" : selected ? "#00f0ff" : "#1e293b";
  const strokeW = awaiting || selected ? 2.2 : 1.6;
  const bodyFill = halted ? "#cbd5e1" : "#f8fafc";

  return (
    <svg
      viewBox="0 0 32 44"
      width="32"
      height="44"
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))" }}
    >
      {/* cargo body */}
      <rect x="4" y="14" width="24" height="28" rx="3.5" fill={bodyFill} stroke={strokeColor} strokeWidth={strokeW} />
      {/* cab (front) */}
      <path d="M6 15 C6 5.5, 26 5.5, 26 15 Z" fill="#e2e8f0" stroke={strokeColor} strokeWidth="1.4" />
      {/* windshield */}
      <path d="M9.5 12.5 C9.5 8.5, 22.5 8.5, 22.5 12.5 Z" fill="#0f172a" />
      {/* roof ribs */}
      <line x1="5" y1="22" x2="27" y2="22" stroke="#cbd5e1" strokeWidth="0.9" />
      <line x1="5" y1="29" x2="27" y2="29" stroke="#cbd5e1" strokeWidth="0.9" />
      <line x1="5" y1="36" x2="27" y2="36" stroke="#cbd5e1" strokeWidth="0.9" />
      {/* headlights */}
      <circle cx="10" cy="7.5" r="1.3" fill={halted ? "#94a3b8" : "#fde68a"} />
      <circle cx="22" cy="7.5" r="1.3" fill={halted ? "#94a3b8" : "#fde68a"} />
      {/* amber hazard lights when halted */}
      {halted && (
        <>
          <circle cx="6" cy="20" r="1.5" fill="#f59e0b" opacity="0.9" />
          <circle cx="26" cy="20" r="1.5" fill="#f59e0b" opacity="0.9" />
        </>
      )}
    </svg>
  );
}
