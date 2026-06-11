/**
 * The ColdGrid Zustand store — the single React-facing wrapper around the pure
 * engine + Chennai data (RULE 1: the engine never imports this; this imports
 * the engine).
 *
 * Phase 3 scope: holds the static city graph, a city clock (hour of day), a
 * scenario ambient override, and map interaction state (hover/selection). The
 * simulation tick loop and live shipments arrive in Phase 4 — the shape here
 * is deliberately forward-compatible with that.
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

export interface ColdgridState {
  // ── City graph (static) ─────────────────────────────────────────────────
  nodes: CityNode[];
  edges: CityEdge[];

  // ── Environment ─────────────────────────────────────────────────────────
  /** City clock, hours 0–24 (drives the diurnal ambient profile). */
  hourOfDay: number;
  /** Scenario ambient override °C (heatwave +5, monsoon −2, …). */
  scenarioOffsetC: number;

  // ── Map interaction ─────────────────────────────────────────────────────
  hoveredNodeId: string | null;
  selectedNodeId: string | null;

  // ── Actions ─────────────────────────────────────────────────────────────
  setHourOfDay: (hour: number) => void;
  setScenarioOffsetC: (offsetC: number) => void;
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (id: string | null) => void;

  // ── Derived helpers ─────────────────────────────────────────────────────
  /** Effective temperature of goods held at a node, given the current clock + scenario. */
  nodeTempC: (node: CityNode) => number;
  /** City-wide ambient at the current clock + scenario. */
  currentAmbientC: () => number;
}

export const useColdgridStore = create<ColdgridState>((set, get) => ({
  nodes: CHENNAI_NODES,
  edges: CHENNAI_EDGES,

  hourOfDay: 14.5, // start at the afternoon peak so the heat is visible
  scenarioOffsetC: 0,

  hoveredNodeId: null,
  selectedNodeId: null,

  setHourOfDay: (hour) =>
    set({ hourOfDay: ((hour % 24) + 24) % 24 }), // wrap into [0,24)
  setScenarioOffsetC: (offsetC) => set({ scenarioOffsetC: offsetC }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  nodeTempC: (node) => {
    const { hourOfDay, scenarioOffsetC } = get();
    return nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  },
  currentAmbientC: () => {
    const { hourOfDay, scenarioOffsetC } = get();
    return cityAmbientC(hourOfDay, scenarioOffsetC);
  },
}));
