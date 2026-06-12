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
  resolveCrisis,
  stepSimulation,
} from "@/lib/engine/simulation";
import { type WeatherData, fetchChennaiWeather } from "@/lib/weather/api";

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
  /** City-wide spoilage-risk heatmap overlay toggle (Phase 8). */
  showHeatmap: boolean;
  /** Scripted Demo Mode is running (Phase 8). */
  demoActive: boolean;

  // ── Weather Integration ─────────────────────────────────────────────────
  weatherData: WeatherData | null;
  liveWeatherEnabled: boolean;
  fetchWeather: () => Promise<void>;
  toggleLiveWeather: () => void;

  // ── Route selection modal ───────────────────────────────────────────────
  /** Pending dispatch options waiting for route selection. Null = modal closed. */
  pendingDispatch: Omit<DispatchOptions, 'route'> | null;

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
  /** Resolve a crisis event with a chosen option. */
  resolveCrisis: (crisisId: string, optionId: string) => void;

  // ── Route selection actions ─────────────────────────────────────────────
  setPendingDispatch: (opts: Omit<DispatchOptions, 'route'> | null) => void;

  // ── Environment actions ─────────────────────────────────────────────────
  setHourOfDay: (hour: number) => void;
  setScenarioOffsetC: (offsetC: number) => void;

  // ── Interaction actions ─────────────────────────────────────────────────
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;
  setSelectedShipment: (id: string | null) => void;
  toggleHeatmap: () => void;
  setHeatmap: (on: boolean) => void;
  setDemoActive: (active: boolean) => void;
  /** Reset to a fixed seed for a deterministic, repeatable run (Demo Mode). */
  resetToSeed: (seed: number, startHourOfDay?: number) => void;

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
  showHeatmap: false,
  demoActive: false,
  pendingDispatch: null,
  weatherData: null,
  liveWeatherEnabled: false,

  fetchWeather: async () => {
    const data = await fetchChennaiWeather();
    if (data) {
      set({ weatherData: data });
      // Check for heatwave auto-trigger
      if (data.hourly.temperature_2m.some((t) => t >= 36)) {
        // Only trigger if we aren't already in it and are in the academy
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
    
    // Auto-update scenarioOffsetC and scenarioBaseRH when toggled on, if we have weather data
    if (enabled && weatherData) {
      const realTemp = weatherData.current.temperature_2m;
      const realRH = weatherData.current.relative_humidity_2m;
      set((s) => ({
        sim: { ...s.sim, scenarioOffsetC: realTemp - 32, scenarioBaseRH: realRH } 
      }));
    } else {
      set((s) => ({
        sim: { ...s.sim, scenarioOffsetC: 0, scenarioBaseRH: undefined }
      }));
    }
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSpeed: (speed) => set({ speed }),

  advance: (dtHours) =>
    set((s) => {
      if (dtHours != null) return { sim: stepSimulation(s.sim, dtHours) };
      return { sim: stepSimulation(s.sim, SIM_DT_HOURS) };
    }),

  dispatch: (opts) => set((s) => ({ sim: dispatchShipment(s.sim, opts), pendingDispatch: null })),

  clearDelivered: () => set((s) => ({ sim: clearDelivered(s.sim) })),

  resetSim: () => set({ sim: createSimulation(SEED), isPlaying: false }),

  loadSim: (sim) => set({ sim, isPlaying: false }),

  resolveCrisis: (crisisId, optionId) =>
    set((s) => ({ sim: resolveCrisis(s.sim, crisisId, optionId) })),

  setPendingDispatch: (opts) => set({ pendingDispatch: opts }),

  setHourOfDay: (hour) =>
    set((s) => ({ sim: { ...s.sim, hourOfDay: ((hour % 24) + 24) % 24 } })),
  setScenarioOffsetC: (offsetC) =>
    set((s) => ({ sim: { ...s.sim, scenarioOffsetC: offsetC } })),

  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setSelectedShipment: (id) => set({ selectedShipmentId: id }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  setHeatmap: (on) => set({ showHeatmap: on }),
  setDemoActive: (active) => set({ demoActive: active }),
  resetToSeed: (seed, startHourOfDay) =>
    set({ sim: createSimulation(seed, { startHourOfDay }), isPlaying: false }),

  nodeTempC: (node) => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  },
  currentAmbientC: () => {
    const { hourOfDay, scenarioOffsetC } = get().sim;
    return cityAmbientC(hourOfDay, scenarioOffsetC);
  },
}));
