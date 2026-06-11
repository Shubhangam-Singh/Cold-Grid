"use client";

/**
 * The wall-clock tick driver. Keeps the pure engine pure (RULE 1): the loop
 * lives here in a React effect, calling the store's advance() on an interval
 * while playing. Renders nothing.
 */

import { useEffect } from "react";
import { TICK_INTERVAL_MS, useColdgridStore } from "@/store/coldgridStore";

export default function SimulationClock() {
  useEffect(() => {
    const id = setInterval(() => {
      const { isPlaying, advance } = useColdgridStore.getState();
      if (isPlaying) advance();
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
