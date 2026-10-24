/**
 * Plain snapshot the copilot reasons over. The browser posts this, or builds
 * it locally. Shipments are the engine's own objects so shelf-life math is
 * not reimplemented here.
 */

import type { LedgerBlock } from "../chain/types";
import { edgeAmbientC, getEdge } from "../city/chennai";
import type { Shipment, SimulationState } from "../engine/simulation";

export interface CopilotProbe {
  shipmentId: string;
  tempC: number;
  rh: number;
  voc: number;
  /** Seconds since the sample. */
  ageS: number;
  stale: boolean;
}

export interface CopilotChain {
  /** True only when a chain RPC has actually answered. Default is false. */
  anchored: boolean;
  kind: "none" | "open" | "genesis";
  blocks: LedgerBlock[];
}

export interface CopilotWorld {
  hourOfDay: number;
  scenarioOffsetC: number;
  closedEdgeIds: string[];
  clockHours: number;
  shipments: Shipment[];
  /** Recent cargo temperatures, oldest first. The probe truck can carry a real trace. */
  recentTemps: Record<string, number[]>;
  probe: CopilotProbe | null;
  chain: CopilotChain;
}

export function emptyChain(): CopilotChain {
  return { anchored: false, kind: "none", blocks: [] };
}

export function worldFromSim(
  sim: SimulationState,
  extras: {
    probe?: CopilotProbe | null;
    chain?: CopilotChain;
    recentTemps?: Record<string, number[]>;
  } = {}
): CopilotWorld {
  return {
    hourOfDay: sim.hourOfDay,
    scenarioOffsetC: sim.scenarioOffsetC,
    closedEdgeIds: sim.closedEdgeIds,
    clockHours: sim.clockHours,
    shipments: sim.shipments,
    recentTemps: extras.recentTemps ?? {},
    probe: extras.probe ?? null,
    chain: extras.chain ?? emptyChain(),
  };
}

/** Cargo temperature the copilot is allowed to treat as measured. */
export function cargoReading(world: CopilotWorld, shipment: Shipment): {
  tempC: number;
  rh: number;
  voc: number;
  source: "probe" | "sim";
} {
  const probe = world.probe;
  if (
    probe &&
    !probe.stale &&
    probe.shipmentId === shipment.id &&
    Number.isFinite(probe.tempC)
  ) {
    return { tempC: probe.tempC, rh: probe.rh, voc: probe.voc, source: "probe" };
  }
  return { tempC: shipment.lastTempC, rh: shipment.lastRH, voc: shipment.lastVOC, source: "sim" };
}

/**
 * Cargo temperature this truck would have with the cart disconnected.
 * A reefer stays on its setpoint. An open truck sits at the route's city ambient.
 * `lastTempC` is not this number once the clock has copied the probe in.
 */
export function unprobedCargoC(world: CopilotWorld, shipment: Shipment): number {
  if (shipment.transportSetpointC != null && Number.isFinite(shipment.transportSetpointC)) {
    return shipment.transportSetpointC;
  }
  const edgeId = shipment.route[shipment.legIndex];
  if (!edgeId) return shipment.lastTempC;
  return edgeAmbientC(getEdge(edgeId), world.hourOfDay, world.scenarioOffsetC);
}

/**
 * Copy of the world whose probed truck carries the cart sample in lastTempC.
 * The heuristic engine can then run unchanged and still see the probe.
 */
export function withMeasuredCargo(world: CopilotWorld): CopilotWorld {
  if (!world.probe || world.probe.stale) return world;
  const id = world.probe.shipmentId;
  return {
    ...world,
    shipments: world.shipments.map((s) => {
      if (s.id !== id) return s;
      const reading = cargoReading(world, s);
      if (reading.source !== "probe") return s;
      return { ...s, lastTempC: reading.tempC, lastRH: reading.rh, lastVOC: reading.voc };
    }),
  };
}
