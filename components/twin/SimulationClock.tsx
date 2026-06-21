"use client";

/**
 * The wall-clock tick driver. Keeps the pure engine pure (RULE 1): the loop
 * lives here in a React effect, calling the store's advance() on an interval
 * while playing. Renders nothing.
 *
 * Phase 9+:
 * - Calls releaseHaltedTrucks() each tick — auto-resumes HALTED trucks when
 *   sim.clockHours passes their haltUntilClockHours. Sim-clock driven, NOT setTimeout.
 * - Calls syncCrisisQueue() after every advance so newly-fired crises
 *   immediately transition the correct truck to AWAITING_COMMAND.
 * - Handles forcedCrises from the current scenario (fires them at exact clockHours).
 * - Respects crisisEnabled: false (Tutorial) by skipping syncCrisisQueue entirely.
 */

import { useEffect, useRef } from "react";
import { TICK_INTERVAL_MS, useColdgridStore } from "@/store/coldgridStore";
import { useAcademyStore } from "@/store/academyStore";
import { getScenario } from "@/lib/academy/scenarios";
import { createCrisis } from "@/lib/engine/crisisEvents";

export default function SimulationClock() {
  const isPlaying = useColdgridStore((s) => s.isPlaying);
  const speed = useColdgridStore((s) => s.speed);
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const academyPhase = useAcademyStore((s) => s.phase);

  // Track which forced crises have already been fired (by index)
  const firedForcedCrises = useRef<Set<number>>(new Set());

  // Reset fired-crisis tracking when scenario changes
  useEffect(() => {
    firedForcedCrises.current = new Set();
  }, [scenarioId]);

  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = TICK_INTERVAL_MS / speed;

    const id = setInterval(() => {
      const store = useColdgridStore.getState();
      store.advance();

      // ── 1. Release halted trucks whose repair time has elapsed in sim-time ──
      // (sim-clock-driven; no wall-clock setTimeout for this any more)
      store.releaseHaltedTrucks();

      // ── 1b. Park diverted trucks that have reached their cold hub ──────────
      store.settleHeldArrivals();

      // ── 2. Resolve crisis-enabled flag for this scenario ──────────────────
      let crisisEnabled = true;
      let forcedCrises = undefined;

      if (scenarioId && academyPhase === "running") {
        try {
          const scenario = getScenario(scenarioId);
          crisisEnabled = scenario.crisisEnabled !== false; // undefined → true
          forcedCrises = scenario.forcedCrises;
        } catch {
          // Unknown scenario ID — default to enabled
        }
      }

      // ── 3. Fire forced crises at the correct sim clock time ───────────────
      if (crisisEnabled && forcedCrises && forcedCrises.length > 0) {
        const sim = useColdgridStore.getState().sim;
        for (let i = 0; i < forcedCrises.length; i++) {
          const forced = forcedCrises[i];
          if (!firedForcedCrises.current.has(i) && sim.clockHours >= forced.atClockHours) {
            firedForcedCrises.current.add(i);
            const inTransit = sim.shipments.filter((s) => s.status === "in-transit");
            const targetShipment = inTransit[forced.deliveryIndex];
            if (targetShipment && targetShipment.route.length > 0) {
              const edgeId = targetShipment.route[targetShipment.legIndex];
              const crisis = createCrisis(
                forced.type,
                targetShipment.id,
                edgeId,
                targetShipment.destinationId,
                sim.tick,
                sim.closedEdgeIds,
                targetShipment.batch.quality
              );
              useColdgridStore.setState((s) => ({
                sim: { ...s.sim, activeCrises: [...s.sim.activeCrises, crisis] },
              }));
            }
          }
        }
      }

      // ── 4. Sync newly-fired crises with the truck state machine ───────────
      // Skipped entirely in Tutorial (crisisEnabled: false)
      if (crisisEnabled) {
        store.syncCrisisQueue();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [isPlaying, speed, scenarioId, academyPhase]);

  return null;
}
