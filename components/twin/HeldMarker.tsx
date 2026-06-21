"use client";

/**
 * Static map marker for a load PARKED at a cold hub (incomplete delivery). Shows
 * the live accruing storage fee and acts as a one-tap "resume" control. Projects
 * the hub coordinate to screen space each frame via the shared viewportRef.
 */

import { useEffect, useRef } from "react";
import type { WebMercatorViewport } from "@deck.gl/core";
import { getNode } from "@/lib/city/chennai";
import { useColdgridStore } from "@/store/coldgridStore";
import { type HeldShipment, heldFeeRupees } from "@/lib/logistics/hubHold";

interface Props {
  held: HeldShipment;
  viewportRef: React.MutableRefObject<WebMercatorViewport | null>;
}

export default function HeldMarker({ held, viewportRef }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const clockHours = useColdgridStore((s) => s.sim.clockHours);
  const resumeFromHub = useColdgridStore((s) => s.resumeFromHub);
  const coords = getNode(held.hubId).coordinates;
  const fee = heldFeeRupees(held, clockHours);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const vp = viewportRef.current;
      const outer = outerRef.current;
      if (vp && outer) {
        const [x, y] = vp.project(coords);
        outer.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -135%)`;
        outer.style.opacity = "1";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [viewportRef, coords]);

  return (
    <div
      ref={outerRef}
      className="absolute left-0 top-0 z-10 pointer-events-auto will-change-transform"
      style={{ transform: "translate3d(-9999px,-9999px,0)" }}
    >
      <button
        onClick={() => resumeFromHub(held.shipmentId)}
        title={`Held at ${held.hubName} — resume → ${held.originalDestName}`}
        className="flex flex-col items-center gap-0.5 rounded-lg border border-amber-500/70 bg-slate-950/90 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur transition active:scale-95"
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-400">
          ⏸ Held
        </span>
        <span className="font-mono text-[9px] text-slate-300">
          ₹{Math.round(fee).toLocaleString("en-IN")}
        </span>
      </button>
    </div>
  );
}
