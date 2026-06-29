/**
 * The ColdGrid Zustand store — the single React-facing wrapper around the pure
 * engine + Chennai data (RULE 1: the engine never imports this; this imports
 * the engine).
 *
 * Phase 4: the store now owns a live SimulationState and playback controls. The
 * tick loop itself lives in a React effect (components/twin/SimulationClock) so
 * the engine stays pure and headless-testable.
 *
 * Phase 9+: adds the Truck State Machine (presentation-only). The engine still
 * owns position/physics — this layer controls visual state (rAF freeze, badges,
 * dialog queue). State transitions go through transitionTruckState only.
 */

import { create } from "zustand";
import {
  CHENNAI_EDGES,
  CHENNAI_NODES,
  type CityEdge,
  type CityNode,
  cityAmbientC,
  getNode,
  nodeHoldingTempC,
  planRoute,
} from "@/lib/city/chennai";
import {
  SIM_DT_HOURS,
  type DispatchOptions,
  type Shipment,
  type SimulationState,
  clearDelivered,
  createSimulation,
  dispatchShipment,
  resolveCrisis,
  stepSimulation,
} from "@/lib/engine/simulation";
import type { CrisisEvent } from "@/lib/engine/crisisEvents";
import { type HeldShipment, heldFeeRupees } from "@/lib/logistics/hubHold";
import { type WeatherData, fetchChennaiWeather } from "@/lib/weather/api";

/**
 * Wall-clock interval between ticks at all speeds (ms).
 *
 * Calibration: SIM_DT_HOURS = 0.01h per tick at 1×.
 *   600ms/tick × (1 tick / 600ms) = 1 tick/s → 0.01h/s = 0.6 sim-min/s... wait
 *   Actually: 1 tick = 600ms, so ticks/sec = 1000/600 = 1.667.
 *   sim-min/sec = 1.667 × 0.01h × 60 = 1.0 sim-min/sec. ✅
 *
 * Higher speeds shrink the interval to animate smoothly, but we floor it at
 * 50ms (20 FPS) because browsers can't reliably fire setInterval below ~16-30ms,
 * and React renders get heavy. If we hit the 50ms floor, we compensate by
 * advancing more sim-time (dtHours) per tick.
 *   At 4×:  interval = 150ms, dtHours = 0.01h → 4  sim-min / real-sec
 *   At 16×: interval = 50ms,  dtHours = 0.0133h → 16 sim-min / real-sec
 *   At 32×: interval = 50ms,  dtHours = 0.0266h → 32 sim-min / real-sec
 */
export const TICK_INTERVAL_MS = 600;

/** Selectable playback speeds. Each multiplies how fast sim-minutes advance. */
export const SPEEDS = [1, 4, 16, 32] as const;

const SEED = 12345;

// ─────────────────────────────────────────────────────────────────────────────
// Truck State Machine (presentation-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Visual-only truck state. Engine owns position/physics; this drives rAF
 * behavior, badges, and dialog display.
 *
 * MOVING          → normal 60fps rAF interpolation
 * DECELERATING    → smoothing factor ramps down over 1.5s
 * HALTED          → rAF frozen at current screen position, timer shown
 * AWAITING_COMMAND→ HALTED + amber pulsing ring + DecisionDialog open
 * EXECUTING_DECISION → 0.8s confirmation animation playing
 * REROUTING       → 180° spin then follows new route polyline
 * ACCELERATING    → smoothing factor ramps up over 1.5s
 */
export type TruckState =
  | "MOVING"
  | "DECELERATING"
  | "HALTED"
  | "AWAITING_COMMAND"
  | "EXECUTING_DECISION"
  | "REROUTING"
  | "ACCELERATING";

/** Badge shown on the truck marker (null = no badge). */
export type TruckBadge =
  | "LIMPING"
  | "NO_REEFER"
  | "NO_REEFER_SPRINT"
  | "CRAWLING"
  | "REPAIRING"
  | null;

export interface TruckVisualState {
  state: TruckState;
  badge: TruckBadge;
  /**
   * Sim-time clock hours at which the halt ends (used for the repair countdown
   * and auto-release). Driven by sim.clockHours, NOT wall clock.
   * null = no timed halt (badge-only states).
   */
  haltUntilClockHours: number | null;
  /** Wall-clock timestamp (ms) when this state was entered (for UI animations). */
  enteredAt: number;
}

export interface ColdgridState {
  // ── City graph (static) ─────────────────────────────────────────────────
  nodes: CityNode[];
  edges: CityEdge[];

  // ── Simulation ──────────────────────────────────────────────────────────
  sim: SimulationState;
  isPlaying: boolean;
  speed: number;

  // ── Map interaction ─────────────────────────────────────────────────────
  hoveredNodeId: string | null;
  selectedNodeId: string | null;
  /** Shipment whose decay curve is open (null = closed). */
  selectedShipmentId: string | null;
  /** City-wide spoilage-risk heatmap overlay toggle. */
  showHeatmap: boolean;
  /** Node-name labels on the map (off declutters the wider regional view). */
  showLabels: boolean;
  /** Urban Heat Island overlay: warmer dense-concrete zones vs cooler water/green. */
  showUHI: boolean;
  /** Scripted Demo Mode is running. */
  demoActive: boolean;

  // ── Weather Integration ─────────────────────────────────────────────────
  weatherData: WeatherData | null;
  liveWeatherEnabled: boolean;
  fetchWeather: () => Promise<void>;
  toggleLiveWeather: () => void;

  // ── Route selection modal ───────────────────────────────────────────────
  /** Pending dispatch options waiting for route selection. Null = modal closed. */
  pendingDispatch: Omit<DispatchOptions, "route"> | null;

  // ── Truck State Machine ─────────────────────────────────────────────────
  /** Visual state per shipment ID. Presentation-only. */
  truckStates: Record<string, TruckVisualState>;
  /** Crises waiting to show their dialog (behind the active one). */
  crisisQueue: CrisisEvent[];
  /** ID of the crisis whose DecisionDialog is currently open. */
  activeCrisisId: string | null;
  /** Edge IDs with a blocked/danger overlay on the map. */
  blockedEdgeIds: string[];
  /** Shipment ID → new route edge IDs (flash "new route" layer after reroute). */
  reroutedShipments: Record<string, string[]>;
  /**
   * Loads diverted to a cold hub: their delivery is INCOMPLETE until resumed.
   * Keyed by shipment id. While parked they accrue a per-hour storage fee.
   */
  heldShipments: Record<string, HeldShipment>;
  /** Hub storage fees already banked from loads that have since been resumed. */
  hubFeesPaidRupees: number;

  // ── Playback actions ────────────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  advance: (dtHours?: number) => void;
  dispatch: (opts: DispatchOptions) => void;
  clearDelivered: () => void;
  resetSim: () => void;
  loadSim: (sim: SimulationState) => void;
  resolveCrisis: (crisisId: string, optionId: string) => void;

  // ── Route selection ─────────────────────────────────────────────────────
  setPendingDispatch: (opts: Omit<DispatchOptions, "route"> | null) => void;

  // ── Environment ─────────────────────────────────────────────────────────
  setHourOfDay: (hour: number) => void;
  setScenarioOffsetC: (offsetC: number) => void;

  // ── Interaction ─────────────────────────────────────────────────────────
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedShipment: (id: string | null) => void;
  toggleHeatmap: () => void;
  setHeatmap: (on: boolean) => void;
  toggleLabels: () => void;
  toggleUHI: () => void;
  /** Post-advance: park diverted trucks that have reached their cold hub. */
  settleHeldArrivals: () => void;
  /** Re-dispatch a parked load from its cold hub to its original destination. */
  resumeFromHub: (shipmentId: string) => void;
  setDemoActive: (active: boolean) => void;
  resetToSeed: (seed: number, startHourOfDay?: number) => void;

  // ── Truck State Machine ─────────────────────────────────────────────────
  /**
   * The ONLY way to mutate a truck's visual state. No direct truckStates mutation.
   */
  transitionTruckState: (
    shipmentId: string,
    next: TruckState,
    opts?: { badge?: TruckBadge; haltUntilClockHours?: number | null }
  ) => void;
  /**
   * Called by SimulationClock after every advance() to reconcile newly-fired
   * crises with the dialog queue and truck state machine.
   */
  syncCrisisQueue: () => void;
  /** Dequeue and show the next crisis dialog. */
  dequeueNextCrisis: () => void;
  /**
   * Called by SimulationClock after every advance() to auto-release trucks
   * whose halt time (in sim clock hours) has elapsed.
   */
  releaseHaltedTrucks: () => void;

  // ── Derived helpers ─────────────────────────────────────────────────────
  nodeTempC: (node: CityNode) => number;
  currentAmbientC: () => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

const TRUCK_STATE_RESET = {
  truckStates: {} as Record<string, TruckVisualState>,
  crisisQueue: [] as CrisisEvent[],
  activeCrisisId: null as string | null,
  blockedEdgeIds: [] as string[],
  reroutedShipments: {} as Record<string, string[]>,
  heldShipments: {} as Record<string, HeldShipment>,
  hubFeesPaidRupees: 0,
};

export const useColdgridStore = create<ColdgridState>((set, get) => ({
  nodes: CHENNAI_NODES,
  edges: CHENNAI_EDGES,

  sim: createSimulation(SEED),
  isPlaying: false,
  speed: 2,

  hoveredNodeId: null,
  selectedNodeId: null,
  selectedShipmentId: null,
  showHeatmap: false,
  showLabels: true,
  showUHI: false,
  demoActive: false,
  pendingDispatch: null,
  weatherData: null,
  liveWeatherEnabled: false,

  ...TRUCK_STATE_RESET,

  // ── Weather ───────────────────────────────────────────────────────────────

  fetchWeather: async () => {
    const data = await fetchChennaiWeather();
    if (data) {
      set({ weatherData: data });
      if (data.hourly.temperature_2m.some((t) => t >= 36)) {
        const academyStore = (await import("@/store/academyStore")).useAcademyStore;
        if (academyStore.getState().scenarioId !== "heatwave") {
          academyStore.getState().openBriefing("heatwave");
        }
      }
    }
  },

  toggleLiveWeather: () => {
    const { liveWeatherEnabled, weatherData } = get();
    const enabled = !liveWeatherEnabled;
    set({ liveWeatherEnabled: enabled });
    if (enabled && weatherData) {
      const realTemp = weatherData.current.temperature_2m;
      const realRH = weatherData.current.relative_humidity_2m;
      set((s) => ({ sim: { ...s.sim, scenarioOffsetC: realTemp - 32, scenarioBaseRH: realRH } }));
    } else {
      set((s) => ({ sim: { ...s.sim, scenarioOffsetC: 0, scenarioBaseRH: undefined } }));
    }
  },

  // ── Playback ─────────────────────────────────────────────────────────────

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),

  advance: (dtHours) =>
    set((s) => ({
      sim: stepSimulation(s.sim, dtHours ?? SIM_DT_HOURS),
    })),

  dispatch: (opts) =>
    set((s) => ({ sim: dispatchShipment(s.sim, opts), pendingDispatch: null })),

  clearDelivered: () => set((s) => ({ sim: clearDelivered(s.sim) })),

  resetSim: () => set({ sim: createSimulation(SEED), isPlaying: false, ...TRUCK_STATE_RESET }),

  loadSim: (sim) => set({ sim, isPlaying: false, ...TRUCK_STATE_RESET }),

  // ── Crisis Resolution ─────────────────────────────────────────────────────

  resolveCrisis: (crisisId, optionId) => {
    const { sim, transitionTruckState, dequeueNextCrisis } = get();
    const crisis = sim.activeCrises.find((c) => c.id === crisisId);
    if (!crisis) return;

    const option = crisis.options.find((o) => o.id === optionId);
    if (!option) return;

    // Flash EXECUTING_DECISION for 0.8s (confirmation animation)
    transitionTruckState(crisis.shipmentId, "EXECUTING_DECISION", {});

    // Determine badge and next visual state
    let badge: TruckBadge = null;
    let nextState: TruckState = "ACCELERATING";
    let haltUntilClockHours: number | undefined;

    switch (option.effect.type) {
      case "wait":
        nextState = "HALTED";
        // Track halt end in SIM time — clockHours + delayMinutes/60
        haltUntilClockHours = get().sim.clockHours + option.effect.delayMinutes / 60;
        badge = "REPAIRING";
        break;
      case "reefer_off":
        badge = "NO_REEFER";
        break;
      case "push_through":
        if (option.effect.speedPenalty >= 1.2) badge = "NO_REEFER_SPRINT";
        else if (option.effect.speedPenalty <= 0.45) badge = "CRAWLING";
        else badge = "LIMPING";
        break;
      case "reroute":
        nextState = "REROUTING";
        break;
      case "divert_to_hub":
      case "divert_kitchen":
        // Treated identically to reroute from the truck-animation perspective.
        // The engine's resolveCrisis will update the shipment's destinationId + route.
        nextState = "REROUTING";
        break;
    }

    // Visual overlays
    const newRerouted = { ...get().reroutedShipments };
    const newBlocked = [...get().blockedEdgeIds];
    if (option.effect.type === "reroute") {
      newRerouted[crisis.shipmentId] = option.effect.newEdgeIds;
      if (!newBlocked.includes(crisis.edgeId)) newBlocked.push(crisis.edgeId);
    } else if (option.effect.type === "divert_to_hub" || option.effect.type === "divert_kitchen") {
      // Flash the diversion route on the map, same as a reroute
      newRerouted[crisis.shipmentId] = option.effect.newEdgeIds;
      if (!newBlocked.includes(crisis.edgeId)) newBlocked.push(crisis.edgeId);
    } else if (option.effect.type === "wait" && crisis.type === "road_accident") {
      if (!newBlocked.includes(crisis.edgeId)) newBlocked.push(crisis.edgeId);
    }

    // Apply engine-level resolution.
    // For divert_to_hub: the engine has no case for it, so we patch the crisis
    // option to look like a plain "reroute" before passing to the engine. This
    // keeps the engine untouched while still correctly replacing the route.
    let simForEngine = sim;
    // When diverting to a cold hub, remember where the load was actually headed
    // so the delivery can be resumed from the hub later (it's only INCOMPLETE).
    let heldPatch: Record<string, HeldShipment> | null = null;
    if (option.effect.type === "divert_to_hub" || option.effect.type === "divert_kitchen") {
      const { newEdgeIds } = option.effect;
      const targetId = option.effect.type === "divert_to_hub" ? option.effect.hubId : option.effect.kitchenId;
      if (option.effect.type === "divert_to_hub") {
        const orig = sim.shipments.find((s) => s.id === crisis.shipmentId);
        if (orig && orig.destinationId !== targetId) {
          heldPatch = {
            [crisis.shipmentId]: {
              shipmentId: crisis.shipmentId,
              produce: orig.produce,
              hubId: targetId,
              hubName: getNode(targetId).name,
              originalDestId: orig.destinationId,
              originalDestName: getNode(orig.destinationId).name,
              qualityAtHold: orig.batch.quality,
              arrivedClockHours: null,
              snapshot: null,
            },
          };
        }
      }
      simForEngine = {
        ...sim,
        activeCrises: sim.activeCrises.map((c) => {
          if (c.id !== crisisId) return c;
          return {
            ...c,
            options: c.options.map((o) => {
              if (o.id !== optionId) return o;
              return {
                ...o,
                // Masquerade as reroute so the engine applies the route swap
                effect: { type: "reroute" as const, newEdgeIds },
              };
            }),
          };
        }),
        // Redirect destination and set diverted flag
        shipments: sim.shipments.map((s) => {
          if (s.id !== crisis.shipmentId) return s;
          return { 
            ...s, 
            destinationId: targetId,
            diverted: option.effect.type === "divert_kitchen" ? true : s.diverted
          };
        }),
      };
    }

    const newSim = resolveCrisis(simForEngine, crisis.id, optionId);
    set((s) => ({
      sim: newSim,
      activeCrisisId: null,
      blockedEdgeIds: newBlocked,
      reroutedShipments: newRerouted,
      ...(heldPatch ? { heldShipments: { ...s.heldShipments, ...heldPatch } } : {}),
    }));

    // After 0.8s confirmation animation:
    // 1. Auto-resume simulation
    // 2. Apply the truck's new visual state
    setTimeout(() => {
      // ✅ AUTO-RESUME: sim plays again after every decision
      get().play();

      transitionTruckState(crisis.shipmentId, nextState, { badge, haltUntilClockHours });

      if (nextState === "ACCELERATING") {
        // Settle to MOVING after ramp-up (rAF tau will handle the smooth acceleration)
        setTimeout(() => transitionTruckState(crisis.shipmentId, "MOVING", { badge }), 1500);
      }

      if (nextState === "REROUTING") {
        // After spin animation, accelerate
        setTimeout(() => {
          transitionTruckState(crisis.shipmentId, "ACCELERATING", {});
          setTimeout(() => transitionTruckState(crisis.shipmentId, "MOVING", {}), 1500);
        }, 600);
      }

      // For "wait" states, the truck stays HALTED until releaseHaltedTrucks()
      // detects that sim.clockHours >= haltUntilClockHours. No more setTimeout.

      dequeueNextCrisis();
    }, 800);
  },

  // ── Route selection ───────────────────────────────────────────────────────

  setPendingDispatch: (opts) => set({ pendingDispatch: opts }),

  // ── Environment ───────────────────────────────────────────────────────────

  setHourOfDay: (hour) =>
    set((s) => ({ sim: { ...s.sim, hourOfDay: ((hour % 24) + 24) % 24 } })),
  setScenarioOffsetC: (offsetC) =>
    set((s) => ({ sim: { ...s.sim, scenarioOffsetC: offsetC } })),

  // ── Interaction ───────────────────────────────────────────────────────────

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setSelectedShipment: (id) => set({ selectedShipmentId: id }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  setHeatmap: (on) => set({ showHeatmap: on }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleUHI: () => set((s) => ({ showUHI: !s.showUHI })),

  // ── Cold-hub hold / resume ────────────────────────────────────────────────

  settleHeldArrivals: () => {
    const { sim, heldShipments } = get();
    const ids = Object.keys(heldShipments);
    if (ids.length === 0) return;

    let changed = false;
    const updatedHeld = { ...heldShipments };
    let shipments = sim.shipments;
    for (const id of ids) {
      const held = heldShipments[id];
      if (held.arrivedClockHours != null) continue; // already parked
      const arrived = sim.shipments.find((s) => s.id === id && s.status === "delivered");
      if (arrived) {
        // Truck reached the hub: park it (mark INCOMPLETE), start the fee clock,
        // and pull it out of the active sim so it isn't counted as delivered.
        updatedHeld[id] = {
          ...held,
          arrivedClockHours: sim.clockHours,
          qualityAtHold: arrived.batch.quality,
          snapshot: arrived,
        };
        shipments = shipments.filter((s) => s.id !== id);
        changed = true;
      }
    }
    if (changed) set({ sim: { ...sim, shipments }, heldShipments: updatedHeld });
  },

  resumeFromHub: (shipmentId) => {
    const { sim, heldShipments, hubFeesPaidRupees, transitionTruckState } = get();
    const held = heldShipments[shipmentId];
    if (!held || held.arrivedClockHours == null || !held.snapshot) return;

    const route = planRoute(held.hubId, held.originalDestId, {
      closedEdgeIds: sim.closedEdgeIds,
    });
    if (!route || route.length === 0) return; // no open road — stay parked

    // Bank the accrued storage fee and rebuild the load from the hub, carrying
    // the same cargo (quality/energy/reefer) forward to its original destination.
    const fee = heldFeeRupees(held, sim.clockHours);
    const resumed: Shipment = {
      ...held.snapshot,
      route,
      legIndex: 0,
      legProgress: 0,
      status: "in-transit",
      originId: held.hubId,
      destinationId: held.originalDestId,
      position: getNode(held.hubId).coordinates,
      angle: 0,
      crisisCheckedLegs: [],
      crisisSpeedPenalty: 1.0,
      dispatchClockHours: sim.clockHours,
    };

    const restHeld = { ...heldShipments };
    delete restHeld[shipmentId];
    set({
      sim: { ...sim, shipments: [...sim.shipments, resumed] },
      heldShipments: restHeld,
      hubFeesPaidRupees: hubFeesPaidRupees + fee,
    });
    transitionTruckState(shipmentId, "ACCELERATING", { badge: null });
  },

  setDemoActive: (active) => set({ demoActive: active }),
  resetToSeed: (seed, startHourOfDay) =>
    set({ sim: createSimulation(seed, { startHourOfDay }), isPlaying: false, ...TRUCK_STATE_RESET }),

  // ── Truck State Machine ───────────────────────────────────────────────────

  transitionTruckState: (shipmentId, next, opts = {}) => {
    set((s) => ({
      truckStates: {
        ...s.truckStates,
        [shipmentId]: {
          state: next,
          badge: opts.badge !== undefined
            ? opts.badge
            : (s.truckStates[shipmentId]?.badge ?? null),
          haltUntilClockHours: opts.haltUntilClockHours !== undefined
            ? opts.haltUntilClockHours
            : (s.truckStates[shipmentId]?.haltUntilClockHours ?? null),
          enteredAt: Date.now(),
        },
      },
    }));
  },

  syncCrisisQueue: () => {
    const { sim, activeCrisisId, crisisQueue, transitionTruckState, speed } = get();
    const unresolved = sim.activeCrises.filter((c) => !c.resolved);

    const knownIds = new Set([
      ...(activeCrisisId ? [activeCrisisId] : []),
      ...crisisQueue.map((c) => c.id),
    ]);
    const newCrises = unresolved.filter((c) => !knownIds.has(c.id));
    if (newCrises.length === 0) return;

    // At slow speeds (≤4×), pause so the dialog is clearly visible.
    // At high speeds (16×/32×), keep the sim running — the affected truck is
    // already frozen by crisisSpeedPenalty=0, so other trucks continue moving.
    // The dialog overlay is shown regardless of isPlaying.
    if (speed <= 4) {
      set({ isPlaying: false });
    }

    let nextActiveCrisisId = get().activeCrisisId;
    const nextQueue = [...get().crisisQueue];

    for (const crisis of newCrises) {
      // MOVING → DECELERATING → HALTED → AWAITING_COMMAND (staggered over 3s)
      transitionTruckState(crisis.shipmentId, "DECELERATING", {});
      setTimeout(() => {
        transitionTruckState(crisis.shipmentId, "HALTED", {});
        setTimeout(() => {
          transitionTruckState(crisis.shipmentId, "AWAITING_COMMAND", {});
        }, 1500);
      }, 1500);

      if (!nextActiveCrisisId) {
        nextActiveCrisisId = crisis.id;
      } else {
        nextQueue.push(crisis);
      }
    }

    set({ activeCrisisId: nextActiveCrisisId, crisisQueue: nextQueue });
  },

  dequeueNextCrisis: () => {
    const { crisisQueue } = get();
    if (crisisQueue.length === 0) {
      set({ activeCrisisId: null });
      return;
    }
    const [next, ...rest] = crisisQueue;
    set({ activeCrisisId: next.id, crisisQueue: rest });
  },

  /**
   * Called by SimulationClock after every advance(). Checks all HALTED trucks
   * and auto-releases them when sim.clockHours passes their haltUntilClockHours.
   * This is the sim-clock-driven equivalent of the old setTimeout approach.
   */
  releaseHaltedTrucks: () => {
    const { sim, truckStates, transitionTruckState, blockedEdgeIds } = get();
    const currentClockHours = sim.clockHours;

    for (const [shipmentId, vs] of Object.entries(truckStates)) {
      if (
        vs.state === "HALTED" &&
        vs.haltUntilClockHours !== null &&
        currentClockHours >= vs.haltUntilClockHours
      ) {
        // Halt time elapsed — clear badge, clear any blocked edges for this shipment
        const shipment = sim.shipments.find((s) => s.id === shipmentId);
        // Clear blocked edges tied to this shipment's current leg
        if (shipment) {
          const currentEdgeId = shipment.route[shipment.legIndex];
          set((s) => ({
            blockedEdgeIds: s.blockedEdgeIds.filter((id) => id !== currentEdgeId),
          }));
        }

        // Transition: HALTED → ACCELERATING (clear the halt timer and badge)
        transitionTruckState(shipmentId, "ACCELERATING", {
          badge: null,
          haltUntilClockHours: null,  // explicitly clear so countdown disappears
        });
        // Settle to MOVING after 1.5s
        setTimeout(() => transitionTruckState(shipmentId, "MOVING", { badge: null }), 1500);
      }
    }
  },

  // ── Derived helpers ───────────────────────────────────────────────────────

  nodeTempC: (node) => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  },
  currentAmbientC: () => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return cityAmbientC(hourOfDay, scenarioOffsetC);
  },
}));
