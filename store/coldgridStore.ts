/**
 * The ColdGrid Zustand store — the single React-facing wrapper around the pure
 * engine + Chennai data (RULE 1: the engine never imports this; this imports
 * the engine).
 *
 * Phase 4: the store now owns a live SimulationState and playback controls. The
 * tick loop itself lives in a React effect (components/twin/SimulationClock) so
 * the engine stays pure and headless-testable.
 */

import { create } from "zustand";
import {
  CHENNAI_EDGES,
  CHENNAI_NODES,
  type CityEdge,
  type CityNode,
  cityAmbientC,
  nodeHoldingTempC,
} from "@/lib/city/chennai";
import {
  SIM_DT_HOURS,
  type DispatchOptions,
  type SimulationState,
  clearDelivered,
  createSimulation,
  dispatchShipment,
  stepSimulation,
} from "@/lib/engine/simulation";

/**
 * Wall-clock interval between ticks (ms). Kept short so 1× is smooth (≈10 fps);
 * speed multiplies the NUMBER of fixed SIM_DT_HOURS steps per tick, not the
 * step size — so the trajectory is identical at every speed.
 */
export const TICK_INTERVAL_MS = 100;
/** Selectable playback speeds (steps advanced per tick). */
export const SPEEDS = [1, 2, 4] as const;

const SEED = 12345;

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

  // ── Playback actions ────────────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  /** Advance the sim: `speed` fixed SIM_DT_HOURS steps, or one step of an explicit dt. */
  advance: (dtHours?: number) => void;
  dispatch: (opts: DispatchOptions) => void;
  clearDelivered: () => void;
  resetSim: () => void;
  /** Replace the whole simulation state (used by the Academy to load a scenario). */
  loadSim: (sim: SimulationState) => void;

  // ── Environment actions ─────────────────────────────────────────────────
  setHourOfDay: (hour: number) => void;
  setScenarioOffsetC: (offsetC: number) => void;

  // ── Interaction actions ─────────────────────────────────────────────────
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedShipment: (id: string | null) => void;

  // ── Derived helpers ─────────────────────────────────────────────────────
  nodeTempC: (node: CityNode) => number;
  currentAmbientC: () => number;
}

export const useColdgridStore = create<ColdgridState>((set, get) => ({
  nodes: CHENNAI_NODES,
  edges: CHENNAI_EDGES,

  sim: createSimulation(SEED),
  isPlaying: false,
  speed: 2,

  hoveredNodeId: null,
  selectedNodeId: null,
  selectedShipmentId: null,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),

  advance: (dtHours) =>
    set((s) => {
      // Explicit dt → a single step (tests). Otherwise advance `speed` fixed
      // SIM_DT_HOURS steps so the trajectory is speed-independent.
      if (dtHours != null) return { sim: stepSimulation(s.sim, dtHours) };
      let sim = s.sim;
      for (let i = 0; i < s.speed; i++) sim = stepSimulation(sim, SIM_DT_HOURS);
      return { sim };
    }),

  dispatch: (opts) => set((s) => ({ sim: dispatchShipment(s.sim, opts) })),

  clearDelivered: () => set((s) => ({ sim: clearDelivered(s.sim) })),

  resetSim: () => set({ sim: createSimulation(SEED), isPlaying: false }),

  loadSim: (sim) => set({ sim, isPlaying: false }),

  setHourOfDay: (hour) =>
    set((s) => ({ sim: { ...s.sim, hourOfDay: ((hour % 24) + 24) % 24 } })),
  setScenarioOffsetC: (offsetC) =>
    set((s) => ({ sim: { ...s.sim, scenarioOffsetC: offsetC } })),

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setSelectedShipment: (id) => set({ selectedShipmentId: id }),

  nodeTempC: (node) => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  },
  currentAmbientC: () => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return cityAmbientC(hourOfDay, scenarioOffsetC);
  },
}));
