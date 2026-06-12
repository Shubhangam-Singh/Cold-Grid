"use client";

/**
 * The wall-clock tick driver. Keeps the pure engine pure (RULE 1): the loop
 * lives here in a React effect, calling the store's advance() on an interval
 * while playing. Renders nothing.
 */

import { useEffect } from "react";
import { TICK_INTERVAL_MS, useColdgridStore } from "@/store/coldgridStore";

export default function SimulationClock() {
  const isPlaying = useColdgridStore((s) => s.isPlaying);
  const speed = useColdgridStore((s) => s.speed);

  useEffect(() => {
    if (!isPlaying) return;
    // By dividing the tick interval by speed, we evaluate the simulation
    // path more frequently at high speeds instead of jumping corners.
    const intervalMs = TICK_INTERVAL_MS / speed;
    const id = setInterval(() => {
      useColdgridStore.getState().advance();
    }, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, speed]);

  return null;
}
