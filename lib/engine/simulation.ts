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
  edgePath,
  getEdge,
  getNode,
  pathPositionAndAngle,
  planRouteOptions,
  type RouteStrategy,
  trafficMultiplier,
} from "../city/chennai";
import { mulberry32 } from "./rng";
import { getDriver, DEFAULT_DRIVER_ID } from "./drivers";
import {
  type CrisisEvent,
  shouldCrisisFire,
  createCrisis,
} from "./crisisEvents";

/**
 * Canonical integration step (simulated hours per tick). FIXED across the app:
 * playback speed changes how many of these steps run per wall-clock second, NOT
 * the step size — so a run is byte-identical at 1× / 2× / 4× (and the Academy's
 * on-map animation exactly matches its headless score). Small enough that a
 * marker moves smoothly and is easy to trace at 1×.
 */
export const SIM_DT_HOURS = 0.01;

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
  /** Current compass heading angle in degrees (0 = North, 90 = East). */
  angle: number;
  /**
   * Refrigerated-transport setpoint °C, or null for an ambient (open) truck.
   * When set, the reefer holds the cargo at this temperature instead of the
   * route ambient — the operator’s core cold-chain lever (full control in P5).
   */
  transportSetpointC: number | null;
  /** Cumulative reefer compressor energy drawn (kWh) — drives cost & CO₂ scoring. */
  energyKwh: number;
  /** Most recent synthetic sensor reading (for tooltips/sparklines). */
  lastTempC: number;
  lastRH: number;
  lastVOC: number;
  /** Assigned driver ID. */
  driverId: string;
  /** Speed penalty applied by crisis (1.0 = normal, <1 = slower). */
  crisisSpeedPenalty: number;
  /** Per-leg crisis tracking: legs that already triggered a crisis check. */
  crisisCheckedLegs: number[];
  /** Set to true if redirected to a community kitchen. */
  diverted?: boolean;
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
  /** Scenario base relative humidity (live weather override). */
  scenarioBaseRH?: number;
  /** Roads closed by a scenario (flood). Route planning avoids these. */
  closedEdgeIds: string[];
  shipments: Shipment[];
  /** Monotonic id allocator. */
  nextId: number;
  /** Active crisis events awaiting operator resolution. */
  activeCrises: CrisisEvent[];
  /** Resolved crisis events (history). */
  crisisHistory: CrisisEvent[];
}

const DEFAULT_START_HOUR = 5; // 05:00 — fish lands, the day begins

/**
 * Reefer compressor draw per °C of temperature lift (kW). Documented default:
 * a reefer working against a hot ambient costs energy proportional to how far
 * below ambient it holds the cargo — this is the cold/energy/CO₂ tradeoff the
 * Academy teaches. Tunable.
 */
const COOLING_KW_PER_C = 0.045;

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
  baseRHPct?: number;
  profile: ProduceProfile;
  batch: Batch;
}): { T_C: number; RH: number; VOC: number } {
  const { seed, key, tick, baseTempC, baseRHPct, profile, batch } = args;
  const n = (salt: string) => noise01(seed, key + salt, tick) * 2 - 1; // [-1,1)
  const T_C = baseTempC + n("T") * 0.8;
  const RH = clamp((baseRHPct ?? 80) + n("H") * 10, 40, 100);
  const VOC = Math.max(0, profile.vocRef + batch.cumulativeDeg * 150 + n("G") * 8);
  return { T_C, RH, VOC };
}

/** Geographic position and heading angle at a fractional point along an edge's real road path. */
function edgePositionAndAngle(edgeId: string, legProgress: number): { position: [number, number]; angle: number } {
  return pathPositionAndAngle(edgePath(getEdge(edgeId)), legProgress);
}

interface StepContext {
  seed: number;
  tick: number;
  hourOfDay: number;
  scenarioOffsetC: number;
  scenarioBaseRH?: number;
  dtHours: number;
  closedEdgeIds: string[];
}

/** Advance a single shipment by one tick. Pure: returns a new Shipment. */
export function advanceShipment(s: Shipment, ctx: StepContext): Shipment {
  if (s.status === "delivered" || s.route.length === 0) return s;

  // Check for unresolved crisis — truck is stalled
  // (handled at the SimulationState level, but if the shipment has a
  // crisisSpeedPenalty of 0 it means it's completely stopped)

  const driver = getDriver(s.driverId);
  const profile = getProduce(s.produce);
  const edge = getEdge(s.route[s.legIndex]);
  const routeAmbientC = edgeAmbientC(edge, ctx.hourOfDay, ctx.scenarioOffsetC);
  // A reefer holds its setpoint; an open truck tracks the route ambient.
  const baseTemp = s.transportSetpointC ?? routeAmbientC;
  // Compressor energy: only a reefer pulling cargo below ambient does work.
  // Driver's fuelEfficiency modifies energy consumption.
  const liftC =
    s.transportSetpointC != null ? Math.max(0, routeAmbientC - s.transportSetpointC) : 0;
  const energyKwh =
    s.energyKwh + COOLING_KW_PER_C * liftC * ctx.dtHours * driver.fuelEfficiency;
  const sensors = syntheticSensors({
    seed: ctx.seed,
    key: `${s.id}|${edge.id}`,
    tick: ctx.tick,
    baseTempC: baseTemp,
    baseRHPct: ctx.scenarioBaseRH,
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

  // Dynamic travel time: base travel time × traffic × driver navigation skill
  const driverTrafficMult = trafficMultiplier(ctx.hourOfDay, edge.congestionProne);
  const effectiveTrafficMult = 1 + (driverTrafficMult - 1) * driver.trafficNavigation;
  const effectiveTravelMin = edge.travelTimeMin * effectiveTrafficMult / driver.speedMultiplier;
  // Apply crisis speed penalty if any
  const travelMinWithCrisis = effectiveTravelMin / Math.max(0.1, s.crisisSpeedPenalty);

  let legIndex = s.legIndex;
  let legProgress = s.legProgress + ctx.dtHours / (travelMinWithCrisis / 60);
  let status: ShipmentStatus = "in-transit";
  while (legProgress >= 1 && legIndex < s.route.length - 1) {
    legProgress -= 1;
    legIndex += 1;
  }
  if (legProgress >= 1 && legIndex === s.route.length - 1) {
    legProgress = 1;
    status = "delivered";
  }

  const posAndAngle = edgePositionAndAngle(s.route[legIndex], legProgress);

  // Smooth the heading angle using shortest-arc interpolation.
  // This prevents DeckGL from animating "the long way round" (e.g. 350°→10°
  // going backward through 340° instead of forward through 20°).
  // We also cap the per-tick rotation at 45° so sharp road bends don't cause
  // an instantaneous snap.
  const prevAngle = s.angle ?? posAndAngle.angle;
  const rawAngle = posAndAngle.angle;
  // Normalise delta to (-180, 180]
  let delta = ((rawAngle - prevAngle + 540) % 360) - 180;
  // Clamp max rotation per tick to 45° — larger than any real road bend per step
  const MAX_DEG_PER_TICK = 45;
  delta = Math.max(-MAX_DEG_PER_TICK, Math.min(MAX_DEG_PER_TICK, delta));
  const smoothedAngle = prevAngle + delta;

  return {
    ...s,
    batch,
    legIndex,
    legProgress,
    status,
    energyKwh,
    position: posAndAngle.position,
    angle: smoothedAngle,
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
    activeCrises: [],
    crisisHistory: [],
  };
}

export interface DispatchOptions {
  produce: ProduceId;
  fromId: string;
  toId: string;
  label?: string;
  /** Refrigerated-transport setpoint °C, or null/undefined for an ambient truck. */
  transportSetpointC?: number | null;
  /** Pre-computed route edge IDs (from route selection modal). */
  route?: string[];
  /** Assigned driver ID. Defaults to DEFAULT_DRIVER_ID. */
  driverId?: string;
  /** Route selection strategy. Defaults to "fastest". */
  routeStrategy?: RouteStrategy;
}

/**
 * Dispatch a shipment from a source to a destination. If a pre-computed route
 * is provided, uses it directly; otherwise computes the shortest open route.
 * Pure: returns a new state.
 */
export function dispatchShipment(
  state: SimulationState,
  opts: DispatchOptions
): SimulationState {
  let route = opts.route;
  if (!route) {
    const strategy = opts.routeStrategy ?? "fastest";
    const options = planRouteOptions(opts.fromId, opts.toId, {
      hourOfDay: state.hourOfDay,
      closedEdgeIds: state.closedEdgeIds,
    });
    route = options.find((o) => o.id === strategy)?.edgeIds ?? options[0]?.edgeIds ?? [];
  }
  
  if (route === null || route.length === 0) return state;

  const id = `S${state.nextId}`;
  const profile = getProduce(opts.produce);
  const setpoint = opts.transportSetpointC ?? null;
  const driverId = opts.driverId ?? DEFAULT_DRIVER_ID;
  const driver = getDriver(driverId);

  // Initial sensor snapshot (no noise yet)
  const initialTempC =
    setpoint ?? edgeAmbientC(getEdge(route[0]), state.hourOfDay, state.scenarioOffsetC);

  // Apply driver's cargo handling quality penalty at load time
  const batch = createBatch(id, opts.produce);
  const loadedBatch = driver.cargoHandling < 1
    ? {
        ...batch,
        cumulativeDeg: (1 - driver.cargoHandling) * 0.05, // slight initial damage
        quality: Math.max(0, 100 - (1 - driver.cargoHandling) * 5),
      }
    : batch;

  const initialEdge = route.length > 0 ? route[0] : "";
  const initialPosAndAngle = route.length > 0
    ? edgePositionAndAngle(initialEdge, 0)
    : { position: getNode(opts.fromId).coordinates, angle: 0 };

  const shipment: Shipment = {
    id: `SHP-${state.nextId}`,
    label: opts.label ?? `${profile.label} → ${getNode(opts.toId).name}`,
    produce: opts.produce,
    batch: loadedBatch,
    route,
    legIndex: 0,
    legProgress: 0,
    status: "in-transit",
    originId: opts.fromId,
    destinationId: opts.toId,
    dispatchClockHours: state.clockHours,
    position: initialPosAndAngle.position,
    angle: initialPosAndAngle.angle,
    transportSetpointC: setpoint,
    energyKwh: 0,
    lastTempC: initialTempC,
    lastRH: 80,
    lastVOC: profile.vocRef,
    driverId,
    crisisSpeedPenalty: 1.0,
    crisisCheckedLegs: [],
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
    scenarioBaseRH: state.scenarioBaseRH,
    dtHours,
    closedEdgeIds: state.closedEdgeIds,
  };

  // Advance shipments and check for new crises
  const newCrises: CrisisEvent[] = [];
  const advancedShipments = state.shipments.map((s) => {
    const advanced = advanceShipment(s, ctx);

    // Check for crisis on leg entry (only once per leg per shipment)
    if (
      advanced.status === "in-transit" &&
      !advanced.crisisCheckedLegs.includes(advanced.legIndex) &&
      advanced.legProgress > 0.1 && advanced.legProgress < 0.5
    ) {
      const edge = getEdge(advanced.route[advanced.legIndex]);
      const crisisType = shouldCrisisFire(
        state.seed,
        advanced.id,
        advanced.legIndex,
        advanced.transportSetpointC != null,
        edge.congestionProne
      );
      if (crisisType) {
        const crisis = createCrisis(
          crisisType,
          advanced.id,
          edge.id,
          advanced.destinationId,
          state.tick,
          state.closedEdgeIds,
          advanced.batch.quality
        );
        newCrises.push(crisis);
        // If reefer breakdown, disable reefer
        if (crisisType === "reefer_breakdown") {
          return {
            ...advanced,
            crisisCheckedLegs: [...advanced.crisisCheckedLegs, advanced.legIndex],
            transportSetpointC: null,
          };
        }
      }
      return {
        ...advanced,
        crisisCheckedLegs: [...advanced.crisisCheckedLegs, advanced.legIndex],
      };
    }
    return advanced;
  });

  return {
    ...state,
    shipments: advancedShipments,
    tick: state.tick + 1,
    clockHours: state.clockHours + dtHours,
    hourOfDay: wrap24(state.hourOfDay + dtHours),
    activeCrises: [...state.activeCrises, ...newCrises],
  };
}

/**
 * Resolve a crisis by applying the chosen option's effect to the relevant shipment.
 * Pure: returns a new state.
 */
export function resolveCrisis(
  state: SimulationState,
  crisisId: string,
  optionId: string
): SimulationState {
  const crisis = state.activeCrises.find((c) => c.id === crisisId);
  if (!crisis) return state;

  const option = crisis.options.find((o) => o.id === optionId);
  if (!option) return state;

  const resolvedCrisis: CrisisEvent = {
    ...crisis,
    resolved: true,
    chosenOptionId: optionId,
  };

  let shipments = state.shipments;

  // Apply effect to the target shipment
  const shipIdx = shipments.findIndex((s) => s.id === crisis.shipmentId);
  if (shipIdx >= 0) {
    const ship = shipments[shipIdx];
    let updatedShip = { ...ship };

    switch (option.effect.type) {
      case "wait":
        // Add delay by reducing leg progress (simulating stopped time)
        // The delay is handled by temporarily reducing speed
        updatedShip.crisisSpeedPenalty = 0.3; // slow crawl after delay
        break;
      case "reefer_off":
        updatedShip.transportSetpointC = null;
        break;
      case "push_through":
        updatedShip.crisisSpeedPenalty = option.effect.speedPenalty;
        break;
      case "reroute":
        // Replace current and remaining route with the alternate route
        updatedShip = {
          ...updatedShip,
          route: [
            ...ship.route.slice(0, ship.legIndex),
            ...option.effect.newEdgeIds,
          ],
          legIndex: ship.legIndex,
          legProgress: 0,
        };
        break;
    }

    shipments = [
      ...shipments.slice(0, shipIdx),
      updatedShip,
      ...shipments.slice(shipIdx + 1),
    ];
  }

  return {
    ...state,
    shipments,
    activeCrises: state.activeCrises.filter((c) => c.id !== crisisId),
    crisisHistory: [...state.crisisHistory, resolvedCrisis],
  };
}

/** Convenience: is this shipment's cargo spoiled right now? */
export function shipmentSpoiled(s: Shipment): boolean {
  return isSpoiled(s.batch, getProduce(s.produce));
}

/** Drop all delivered shipments, keeping in-transit ones. Pure. */
export function clearDelivered(state: SimulationState): SimulationState {
  return {
    ...state,
    shipments: state.shipments.filter((s) => s.status !== "delivered"),
  };
}
