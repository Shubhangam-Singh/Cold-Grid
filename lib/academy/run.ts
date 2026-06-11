/**
 * Runs a scenario headlessly: applies the operator's decisions, drives the
 * pure simulation to completion, and reports a per-delivery outcome. PURE and
 * deterministic (RULE 4) — the UI and the tests use the same path.
 */

import { routeDistanceKm } from "../city/chennai";
import {
  type SimulationState,
  createSimulation,
  dispatchShipment,
  stepSimulation,
} from "../engine/simulation";
import type { DeliveryDecision, RequiredDelivery, Scenario } from "./types";

export interface DeliveryResult {
  delivery: RequiredDelivery;
  dispatched: boolean;
  /** Delivered quality 0–100 (0 if spoiled or never dispatched). */
  qualityPct: number;
  onTime: boolean;
  transitHours: number;
  energyKwh: number;
  distanceKm: number;
  reefer: boolean;
  spoiled: boolean;
}

export interface ScenarioRun {
  results: DeliveryResult[];
  finalSim: SimulationState;
  ticks: number;
}

const SCENARIO_SEED = 4242;

/** Build the initial sim for a scenario (environment applied, no shipments). */
export function scenarioInitialSim(scenario: Scenario, seed = SCENARIO_SEED): SimulationState {
  const base = createSimulation(seed, { startHourOfDay: scenario.startHourOfDay });
  return {
    ...base,
    scenarioOffsetC: scenario.scenarioOffsetC,
    closedEdgeIds: scenario.closedEdgeIds,
  };
}

export function simulateScenario(
  scenario: Scenario,
  decisions: DeliveryDecision[],
  opts: { seed?: number; dtHours?: number; maxTicks?: number } = {}
): ScenarioRun {
  const dtHours = opts.dtHours ?? 0.1;
  const maxTicks = opts.maxTicks ?? 200000;

  let sim = scenarioInitialSim(scenario, opts.seed ?? SCENARIO_SEED);
  const shipmentByDelivery = new Map<string, string>();

  for (const d of scenario.requiredDeliveries) {
    const decision = decisions.find((x) => x.deliveryId === d.id);
    if (!decision || !decision.dispatched) continue;
    const before = sim.shipments.length;
    sim = dispatchShipment(sim, {
      produce: d.produce,
      fromId: d.fromId,
      toId: d.toId,
      label: d.label,
      transportSetpointC: decision.reefer ? decision.setpointC : null,
    });
    if (sim.shipments.length > before) {
      shipmentByDelivery.set(d.id, sim.shipments[sim.shipments.length - 1].id);
    }
  }

  let ticks = 0;
  while (sim.shipments.some((s) => s.status === "in-transit") && ticks < maxTicks) {
    sim = stepSimulation(sim, dtHours);
    ticks++;
  }

  const results: DeliveryResult[] = scenario.requiredDeliveries.map((d) => {
    const shipId = shipmentByDelivery.get(d.id);
    const ship = shipId ? sim.shipments.find((s) => s.id === shipId) : undefined;
    if (!ship) {
      return {
        delivery: d,
        dispatched: false,
        qualityPct: 0,
        onTime: false,
        transitHours: 0,
        energyKwh: 0,
        distanceKm: 0,
        reefer: false,
        spoiled: true,
      };
    }
    return {
      delivery: d,
      dispatched: true,
      qualityPct: ship.batch.quality,
      onTime: d.deadlineHours == null ? true : ship.batch.ageHours <= d.deadlineHours,
      transitHours: ship.batch.ageHours,
      energyKwh: ship.energyKwh,
      distanceKm: routeDistanceKm(ship.route),
      reefer: ship.transportSetpointC != null,
      spoiled: ship.batch.quality <= 0,
    };
  });

  return { results, finalSim: sim, ticks };
}
