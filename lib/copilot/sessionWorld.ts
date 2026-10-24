/**
 * Builds the copilot snapshot from the live stores.
 * A fresh cart frame overrides one truck. A silent cart leaves the sim alone.
 */

import type { LedgerBlock } from "../chain/types";
import type { SimulationState } from "../engine/simulation";
import { cartTargetId, type FleetShipmentRef } from "../hardware/fleetOverlay";
import { benchMode } from "../hardware/liveSession";
import type { SensorReading } from "../hardware/types";
import { emptyChain, worldFromSim, type CopilotProbe, type CopilotWorld } from "./world";

export function buildSessionWorld(args: {
  sim: SimulationState;
  listen: boolean;
  connected: boolean;
  attachFish: boolean;
  reading: SensorReading | null;
  history: SensorReading[];
  chain: LedgerBlock[];
  nowMs: number;
  /** True only after a chain RPC has answered. A browser ledger is not this. */
  anchored?: boolean;
}): CopilotWorld {
  const refs: FleetShipmentRef[] = args.sim.shipments.map((s) => ({
    id: s.id,
    originId: s.originId,
    produce: s.produce,
    status: s.status,
  }));
  const target = cartTargetId(refs, args.attachFish);
  let probe: CopilotProbe | null = null;
  if (args.listen && target && args.reading && Number.isFinite(args.reading.tempC)) {
    const mode = benchMode({
      listen: args.listen,
      connected: args.connected,
      reading: args.reading,
      nowMs: args.nowMs,
    });
    probe = {
      shipmentId: target,
      tempC: args.reading.tempC,
      rh: Number.isFinite(args.reading.humidity) ? args.reading.humidity : 0,
      voc: Number.isFinite(args.reading.gas) ? args.reading.gas : 0,
      ageS: Math.max(0, args.nowMs / 1000 - args.reading.at),
      stale: mode !== "live",
    };
  }
  const recentTemps: Record<string, number[]> = {};
  if (target) {
    const temps = args.history.map((row) => row.tempC).filter((t) => Number.isFinite(t)).slice(-24);
    if (temps.length > 0) recentTemps[target] = temps;
  }
  const chain =
    args.chain.length === 0
      ? emptyChain()
      : { anchored: args.anchored === true, kind: "open" as const, blocks: args.chain };
  return worldFromSim(args.sim, { probe, chain, recentTemps });
}
