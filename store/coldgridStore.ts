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
  type DispatchOptions,
  type SimulationState,
  createSimulation,
  dispatchShipment,
  stepSimulation,
} from "@/lib/engine/simulation";

/** Simulated hours advanced per tick at 1× speed. */
export const BASE_DT_HOURS = 0.1;
/** Wall-clock interval between ticks (ms). */
export const TICK_INTERVAL_MS = 150;
/** Selectable playback speeds. */
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

  // ── Playback actions ────────────────────────────────────────────────────
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  /** Advance the sim by one tick (dt defaults to BASE_DT_HOURS × speed). */
  advance: (dtHours?: number) => void;
  dispatch: (opts: DispatchOptions) => void;
  resetSim: () => void;

  // ── Environment actions ─────────────────────────────────────────────────
  setHourOfDay: (hour: number) => void;
  setScenarioOffsetC: (offsetC: number) => void;

  // ── Interaction actions ─────────────────────────────────────────────────
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;

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

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),

  advance: (dtHours) =>
    set((s) => ({ sim: stepSimulation(s.sim, dtHours ?? BASE_DT_HOURS * s.speed) })),

  dispatch: (opts) => set((s) => ({ sim: dispatchShipment(s.sim, opts) })),

  resetSim: () => set({ sim: createSimulation(SEED), isPlaying: false }),

  setHourOfDay: (hour) =>
    set((s) => ({ sim: { ...s.sim, hourOfDay: ((hour % 24) + 24) % 24 } })),
  setScenarioOffsetC: (offsetC) =>
    set((s) => ({ sim: { ...s.sim, scenarioOffsetC: offsetC } })),

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  nodeTempC: (node) => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  },
  currentAmbientC: () => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return cityAmbientC(hourOfDay, scenarioOffsetC);
  },
}));
