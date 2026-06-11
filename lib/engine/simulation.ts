/**
 * City-scale simulation tick loop (spec Phase 4). PURE TypeScript (RULE 1):
 * no React, no DOM. Built entirely on the Phase 1 spoilage engine and the
 * Phase 2 Chennai graph.
 *
 * Determinism (RULE 4): the synthetic sensor feed is a pure function of
 * (seed, key, tick) via mulberry32 — no Math.random, no wall clock. A given
 * seed replays identically, so the demo and the headless tests are exactly
 * reproducible.
 */

import type { Batch, ProduceId, ProduceProfile } from "./types";
import { createBatch, isSpoiled, stepBatch } from "./spoilage";
import { getProduce } from "./produce";
import {
  edgeAmbientC,
  getEdge,
  getNode,
  planRoute,
} from "../city/chennai";
import { mulberry32 } from "./rng";

export type ShipmentStatus = "in-transit" | "delivered";

export interface Shipment {
  id: string;
  label: string;
  produce: ProduceId;
  batch: Batch;
  /** Ordered edge ids from origin to destination. */
  route: string[];
  /** Index into route of the leg currently being traversed. */
  legIndex: number;
  /** Progress 0–1 along the current leg. */
  legProgress: number;
  status: ShipmentStatus;
  originId: string;
  destinationId: string;
  dispatchClockHours: number;
  /** Current geographic position [lon, lat] (for map rendering). */
  position: [number, number];
  /** Most recent synthetic sensor reading (for tooltips/sparklines). */
  lastTempC: number;
  lastRH: number;
  lastVOC: number;
}

export interface SimulationState {
  seed: number;
  /** Integer tick counter — seeds deterministic sensor noise. */
  tick: number;
  /** Absolute simulated hours elapsed since start. */
  clockHours: number;
  /** Wall-clock hour of day 0–24 (drives the diurnal ambient profile). */
  hourOfDay: number;
  /** Scenario ambient override °C (heatwave +5, monsoon −2, …). */
  scenarioOffsetC: number;
  /** Roads closed by a scenario (flood). Route planning avoids these. */
  closedEdgeIds: string[];
  shipments: Shipment[];
  /** Monotonic id allocator. */
  nextId: number;
}

const DEFAULT_START_HOUR = 5; // 05:00 — fish lands, the day begins

function wrap24(h: number): number {
  return ((h % 24) + 24) % 24;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/** Deterministic noise in [0,1) from (seed, key, tick). */
function noise01(seed: number, key: string, tick: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  h = Math.imul(h ^ (tick + 0x6d2b79f5), 0x85ebca6b) >>> 0;
  return mulberry32(h)();
}

/**
 * Synthetic sensor feed for a shipment on an edge (RULE 3 free-mode default).
 * Temperature tracks the route ambient with small noise; humidity is Chennai-
 * humid; VOC/gas rises with the batch's own degradation (a spoiling load
 * off-gasses) so the G post-multiplier becomes active for at-risk stock.
 */
export function syntheticSensors(args: {
  seed: number;
  key: string;
  tick: number;
  baseTempC: number;
  profile: ProduceProfile;
  batch: Batch;
}): { T_C: number; RH: number; VOC: number } {
  const { seed, key, tick, baseTempC, profile, batch } = args;
  const n = (salt: string) => noise01(seed, key + salt, tick) * 2 - 1; // [-1,1)
  const T_C = baseTempC + n("T") * 0.8;
  const RH = clamp(80 + n("H") * 10, 40, 100);
  const VOC = Math.max(0, profile.vocRef + batch.cumulativeDeg * 150 + n("G") * 8);
  return { T_C, RH, VOC };
}

function lerpPos(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Geographic position at a fractional point along an edge. */
function edgePosition(edgeId: string, legProgress: number): [number, number] {
  const e = getEdge(edgeId);
  return lerpPos(
    getNode(e.from).coordinates,
    getNode(e.to).coordinates,
    legProgress
  );
}

interface StepContext {
  seed: number;
  tick: number;
  hourOfDay: number;
  scenarioOffsetC: number;
  dtHours: number;
}

/** Advance a single shipment by one tick. Pure: returns a new Shipment. */
export function advanceShipment(s: Shipment, ctx: StepContext): Shipment {
  if (s.status === "delivered" || s.route.length === 0) return s;

  const profile = getProduce(s.produce);
  const edge = getEdge(s.route[s.legIndex]);
  const baseTemp = edgeAmbientC(edge, ctx.hourOfDay, ctx.scenarioOffsetC);
  const sensors = syntheticSensors({
    seed: ctx.seed,
    key: `${s.id}|${edge.id}`,
    tick: ctx.tick,
    baseTempC: baseTemp,
    profile,
    batch: s.batch,
  });
  const batch = stepBatch(
    s.batch,
    profile,
    sensors.T_C,
    sensors.RH,
    sensors.VOC,
    ctx.dtHours
  );

  let legIndex = s.legIndex;
  let legProgress = s.legProgress + ctx.dtHours / (edge.travelTimeMin / 60);
  let status: ShipmentStatus = "in-transit";
  while (legProgress >= 1 && legIndex < s.route.length - 1) {
    legProgress -= 1;
    legIndex += 1;
  }
  if (legProgress >= 1 && legIndex === s.route.length - 1) {
    legProgress = 1;
    status = "delivered";
  }

  return {
    ...s,
    batch,
    legIndex,
    legProgress,
    status,
    position: edgePosition(s.route[legIndex], legProgress),
    lastTempC: sensors.T_C,
    lastRH: sensors.RH,
    lastVOC: sensors.VOC,
  };
}

/** A fresh simulation with no shipments. */
export function createSimulation(
  seed = 12345,
  opts: { startHourOfDay?: number } = {}
): SimulationState {
  return {
    seed,
    tick: 0,
    clockHours: 0,
    hourOfDay: opts.startHourOfDay ?? DEFAULT_START_HOUR,
    scenarioOffsetC: 0,
    closedEdgeIds: [],
    shipments: [],
    nextId: 1,
  };
}

export interface DispatchOptions {
  produce: ProduceId;
  fromId: string;
  toId: string;
  label?: string;
}

/**
 * Dispatch a shipment from a source to a destination along the shortest open
 * route. Pure: returns a new state. If no route exists, returns state unchanged
 * (caller can detect by reference equality / unchanged shipment count).
 */
export function dispatchShipment(
  state: SimulationState,
  opts: DispatchOptions
): SimulationState {
  const route = planRoute(opts.fromId, opts.toId, {
    closedEdgeIds: state.closedEdgeIds,
  });
  if (route === null) return state;

  const id = `S${state.nextId}`;
  const profile = getProduce(opts.produce);
  const startPos =
    route.length > 0
      ? edgePosition(route[0], 0)
      : getNode(opts.fromId).coordinates;

  // Initial sensor snapshot from the first leg's ambient (no noise yet) so the
  // UI and equality checks never see NaN before the first tick.
  const initialTempC =
    route.length > 0
      ? edgeAmbientC(getEdge(route[0]), state.hourOfDay, state.scenarioOffsetC)
      : getNode(opts.fromId).ambientOffsetC;

  const shipment: Shipment = {
    id,
    label: opts.label ?? `${profile.label} → ${getNode(opts.toId).name}`,
    produce: opts.produce,
    batch: createBatch(id, opts.produce),
    route,
    legIndex: 0,
    legProgress: 0,
    status: route.length === 0 ? "delivered" : "in-transit",
    originId: opts.fromId,
    destinationId: opts.toId,
    dispatchClockHours: state.clockHours,
    position: startPos,
    lastTempC: initialTempC,
    lastRH: 80,
    lastVOC: profile.vocRef,
  };

  return {
    ...state,
    shipments: [...state.shipments, shipment],
    nextId: state.nextId + 1,
  };
}

/** Advance the whole simulation by one tick. Pure: returns a new state. */
export function stepSimulation(
  state: SimulationState,
  dtHours: number
): SimulationState {
  const ctx: StepContext = {
    seed: state.seed,
    tick: state.tick,
    hourOfDay: state.hourOfDay,
    scenarioOffsetC: state.scenarioOffsetC,
    dtHours,
  };
  return {
    ...state,
    shipments: state.shipments.map((s) => advanceShipment(s, ctx)),
    tick: state.tick + 1,
    clockHours: state.clockHours + dtHours,
    hourOfDay: wrap24(state.hourOfDay + dtHours),
  };
}

/** Convenience: is this shipment's cargo spoiled right now? */
export function shipmentSpoiled(s: Shipment): boolean {
  return isSpoiled(s.batch, getProduce(s.produce));
}
