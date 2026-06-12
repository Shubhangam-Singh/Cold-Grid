"use client";

/**
 * TruckMarker — an Uber-style HTML/SVG delivery truck overlaid on the deck.gl
 * map (Phase: Truck Tracking, Parts 1–2).
 *
 * - Reads the AUTHORITATIVE position/heading from the Zustand sim state
 *   (constraint 18 — no parallel simulation), then render-smooths it toward the
 *   target with requestAnimationFrame for buttery 60fps movement (constraint 2).
 * - Projects [lon,lat] → screen pixels via the deck.gl viewport so it stays
 *   glued to the road as you pan/zoom.
 * - Rotates to face its heading (engine angle is a compass bearing: 0 = N,
 *   90 = E, clockwise — which maps 1:1 to CSS rotate()).
 * - Pulsing "live" ring is pure CSS (constraint 8); appears with a scale-up.
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { WebMercatorViewport } from "@deck.gl/core";
import type { Shipment } from "@/lib/engine/simulation";
import { useColdgridStore } from "@/store/coldgridStore";
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

export default function TruckMarker({ shipment, viewportRef }: Props) {
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);
  const selected = useColdgridStore((s) => s.selectedShipmentId === shipment.id);

  // Latest authoritative state, refreshed every render (cheap; rAF reads it).
  const latest = useRef(shipment);
  latest.current = shipment;

  const outerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const dispPos = useRef<[number, number]>([shipment.position[0], shipment.position[1]]);
  const dispAngle = useRef<number>(shipment.angle ?? 0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sh = latest.current;
      const a = smoothing(dt, 0.07); // ~70ms follow — smooth but responsive

      dispPos.current[0] += (sh.position[0] - dispPos.current[0]) * a;
      dispPos.current[1] += (sh.position[1] - dispPos.current[1]) * a;

      // Shortest-arc angle interpolation (avoids spinning the long way round).
      const target = sh.angle ?? dispAngle.current;
      const delta = ((target - dispAngle.current + 540) % 360) - 180;
      dispAngle.current += delta * a;

      const vp = viewportRef.current;
      const outer = outerRef.current;
      if (vp && outer) {
        const [x, y] = vp.project([dispPos.current[0], dispPos.current[1]]);
        const w = vp.width;
        const h = vp.height;
        if (x < -100 || y < -100 || x > w + 100 || y > h + 100) {
          outer.style.opacity = "0"; // cull off-screen
        } else {
          outer.style.opacity = "1";
          outer.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        }
      }
      if (iconRef.current) {
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
        className="relative flex items-center justify-center"
        style={{ width: 36, height: 44 }}
      >
        {/* Pulsing "live" ring — pure CSS */}
        <span className="truck-pulse-ring" aria-hidden />

        {/* Quality-tinted soft glow under the truck (at-a-glance freshness) */}
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

        {/* The truck itself — rotates to heading (imperative, in rAF) */}
        <div ref={iconRef} className="relative will-change-transform" style={{ width: 32, height: 44 }}>
          <TruckSvg selected={selected} />
        </div>

        {/* Click target → opens the decay curve */}
        <button
          onClick={() => setSelectedShipment(shipment.id)}
          className="absolute -inset-1 cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
          aria-label={`${profile.label} shipment, ${q.toFixed(0)}% quality, driver ${driver.name}. Open decay curve.`}
          title={`${profile.label} · ${q.toFixed(0)}% · ${driver.name}`}
          style={{ pointerEvents: "auto" }}
        />
      </motion.div>
    </div>
  );
}

/** Clean top-down delivery truck, pointing UP (north) at rotation 0. */
function TruckSvg({ selected }: { selected: boolean }) {
  return (
    <svg
      viewBox="0 0 32 44"
      width="32"
      height="44"
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))" }}
    >
      {/* cargo body */}
      <rect
        x="4"
        y="14"
        width="24"
        height="28"
        rx="3.5"
        fill="#f8fafc"
        stroke={selected ? "#00f0ff" : "#1e293b"}
        strokeWidth={selected ? 2.2 : 1.6}
      />
      {/* cab (front) */}
      <path d="M6 15 C6 5.5, 26 5.5, 26 15 Z" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.4" />
      {/* windshield */}
      <path d="M9.5 12.5 C9.5 8.5, 22.5 8.5, 22.5 12.5 Z" fill="#0f172a" />
      {/* roof ribs */}
      <line x1="5" y1="22" x2="27" y2="22" stroke="#cbd5e1" strokeWidth="0.9" />
      <line x1="5" y1="29" x2="27" y2="29" stroke="#cbd5e1" strokeWidth="0.9" />
      <line x1="5" y1="36" x2="27" y2="36" stroke="#cbd5e1" strokeWidth="0.9" />
      {/* headlights */}
      <circle cx="10" cy="7.5" r="1.3" fill="#fde68a" />
      <circle cx="22" cy="7.5" r="1.3" fill="#fde68a" />
    </svg>
  );
}
