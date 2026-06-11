/**
 * Chennai city data layer (spec §6) — the real-geography graph the digital
 * twin sits on. PURE TypeScript: no React, no DOM.
 *
 * Coordinates are [longitude, latitude] (deck.gl convention) and are
 * approximate real anchor locations, to be refined visually in Phase 3.
 * Travel times reflect typical Chennai traffic (~14–20 km/h average).
 *
 * Some node pairs deliberately have TWO edges (a fast flood-prone main road
 * and a longer, warmer alternate) — this is what makes the Phase 5 monsoon
 * scenario a real rerouting decision instead of a dead end.
 */

import type { ProduceId } from "../engine/types";
import { EDGE_PATHS } from "./edgePaths";

export type NodeType = "source" | "hub" | "retail";

export interface Refrigeration {
  /** Cold-room setpoint, °C. */
  setpointC: number;
}

export interface CityNode {
  id: string;
  name: string;
  type: NodeType;
  /** [longitude, latitude]. */
  coordinates: [number, number];
  /**
   * Local ambient offset (°C) vs the city baseline — urban-heat-island and
   * coastal-breeze microclimate (e.g. T. Nagar concrete +2, harborfront −0.5).
   */
  ambientOffsetC: number;
  /** null ⇒ unrefrigerated: goods held here track local ambient. */
  refrigeration: Refrigeration | null;
  /** Produce this node injects into the network (source nodes only). */
  handles?: ProduceId[];
  description: string;
}

export interface CityEdge {
  id: string;
  from: string;
  to: string;
  /** Typical travel time under normal traffic, minutes. */
  travelTimeMin: number;
  /** Approximate road distance, km. */
  distanceKm: number;
  /** Route microclimate offset (°C) vs city baseline (coastal cooler, congested concrete hotter). */
  ambientOffsetC: number;
  /** Closes during monsoon-flood scenarios (low-lying / river-crossing roads). */
  floodProne: boolean;
}

/** Chennai bounding box (spec §6): all node coordinates must fall inside. */
export const CHENNAI_BOUNDS = {
  minLat: 12.8,
  maxLat: 13.3,
  minLon: 80.1,
  maxLon: 80.35,
} as const;

/** City-wide mean ambient, °C. Chennai runs 28–38 °C most of the year. */
export const CITY_BASELINE_C = 32;
/** Diurnal swing amplitude, °C: coolest ≈28 pre-dawn, hottest ≈36 mid-afternoon. */
export const DIURNAL_AMPLITUDE_C = 4;
/** Hour of day (0–24) at which ambient peaks. */
export const DIURNAL_PEAK_HOUR = 14.5;

/**
 * City-wide ambient at a given hour of day (fractional hours fine; periodic,
 * so hour 26 ≡ hour 2). scenarioOffsetC is the override hook for Academy
 * events: heatwave +4–6 °C, monsoon cloud cover −2 °C, etc.
 */
export function cityAmbientC(hourOfDay: number, scenarioOffsetC = 0): number {
  const phase = ((hourOfDay - DIURNAL_PEAK_HOUR) / 24) * 2 * Math.PI;
  return CITY_BASELINE_C + DIURNAL_AMPLITUDE_C * Math.cos(phase) + scenarioOffsetC;
}

/** Local ambient at a node (city baseline + node microclimate). */
export function nodeAmbientC(
  node: CityNode,
  hourOfDay: number,
  scenarioOffsetC = 0
): number {
  return cityAmbientC(hourOfDay, scenarioOffsetC) + node.ambientOffsetC;
}

/**
 * Effective temperature experienced by goods HELD at a node: the cold-room
 * setpoint if refrigerated, local ambient otherwise.
 */
export function nodeHoldingTempC(
  node: CityNode,
  hourOfDay: number,
  scenarioOffsetC = 0
): number {
  return node.refrigeration
    ? node.refrigeration.setpointC
    : nodeAmbientC(node, hourOfDay, scenarioOffsetC);
}

/** Ambient along an edge (city baseline + route microclimate). */
export function edgeAmbientC(
  edge: CityEdge,
  hourOfDay: number,
  scenarioOffsetC = 0
): number {
  return cityAmbientC(hourOfDay, scenarioOffsetC) + edge.ambientOffsetC;
}

/**
 * Real road geometry [lon, lat] for an edge (baked from OSRM — see
 * scripts/genEdgePaths.mjs). Falls back to a straight from→to line if missing,
 * so the app never breaks if the data file is absent.
 */
export function edgePath(edge: CityEdge): [number, number][] {
  const path = EDGE_PATHS[edge.id];
  if (path && path.length >= 2) return path;
  return [getNode(edge.from).coordinates, getNode(edge.to).coordinates];
}

/** Point [lon, lat] at arc-length fraction t∈[0,1] along a polyline. */
export function pointAlongPath(
  path: [number, number][],
  t: number
): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  const clamped = Math.max(0, Math.min(1, t));

  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineKm(path[i], path[i + 1]);
    segLen.push(d);
    total += d;
  }
  if (total === 0) return path[0];

  let target = clamped * total;
  for (let i = 0; i < segLen.length; i++) {
    if (target <= segLen[i] || i === segLen.length - 1) {
      const f = segLen[i] === 0 ? 0 : Math.min(1, target / segLen[i]);
      const a = path[i];
      const b = path[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    target -= segLen[i];
  }
  return path[path.length - 1];
}

/** Great-circle distance between two [lon, lat] points, km. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

// ─────────────────────────────────────────────────────────────────────────────
// Nodes
// ─────────────────────────────────────────────────────────────────────────────

export const CHENNAI_NODES: CityNode[] = [
  // ── Sources / wholesale ────────────────────────────────────────────────────
  {
    id: "koyambedu",
    name: "Koyambedu Wholesale Market",
    type: "source",
    coordinates: [80.194, 13.069],
    ambientOffsetC: 1.5, // dense open market, asphalt yards
    refrigeration: null,
    // §6 lists Tomato, Mango, Banana, LeafyVeg. Apple added so every §5.3
    // produce has a source: Koyambedu's fruit section is in fact where
    // imported apples enter Chennai. Flagged in the Phase 2 report.
    handles: ["tomato", "mango", "banana", "leafyVeg", "apple"],
    description:
      "One of Asia's largest perishable markets — fruit & vegetable wholesale for the city.",
  },
  {
    id: "kasimedu",
    name: "Kasimedu Fishing Harbour",
    type: "source",
    coordinates: [80.297, 13.124],
    ambientOffsetC: -0.5, // harborfront sea breeze
    refrigeration: null,
    handles: ["fish"],
    description:
      "Chennai's major fish landing centre — catch comes ashore from ~4 AM.",
  },
  {
    id: "aavin-madhavaram",
    name: "Aavin Dairy, Madhavaram",
    type: "source",
    coordinates: [80.231, 13.148],
    ambientOffsetC: 0.5,
    refrigeration: { setpointC: 4 }, // cooperative dairy cold storage
    handles: ["milk", "paneer"],
    description:
      "Tamil Nadu cooperative dairy complex — chilled milk and paneer dispatch.",
  },

  // ── Cold-storage hubs (intermediate) ──────────────────────────────────────
  {
    id: "hub-perambur",
    name: "Perambur Cold Hub",
    type: "hub",
    coordinates: [80.232, 13.112],
    ambientOffsetC: 0.5,
    refrigeration: { setpointC: 5 },
    description:
      "North-central refrigerated hub serving the harbour, dairy and inner city.",
  },
  {
    id: "hub-guindy",
    name: "Guindy Cold Hub",
    type: "hub",
    coordinates: [80.212, 13.008],
    ambientOffsetC: 0.5,
    refrigeration: { setpointC: 5 },
    description:
      "Southern refrigerated hub on the industrial estate, gateway to Adyar/Velachery.",
  },
  {
    id: "hub-ambattur",
    name: "Ambattur Cold Hub",
    type: "hub",
    coordinates: [80.162, 13.106],
    ambientOffsetC: 0.5,
    refrigeration: { setpointC: 6 },
    description:
      "Western refrigerated hub near the Ambattur industrial estate.",
  },

  // ── Retail / vendor zones (demand) ────────────────────────────────────────
  {
    id: "t-nagar",
    name: "T. Nagar",
    type: "retail",
    coordinates: [80.233, 13.041],
    ambientOffsetC: 2.0, // famously dense concrete shopping district
    refrigeration: null,
    description: "The city's busiest retail district — highest footfall demand.",
  },
  {
    id: "mylapore",
    name: "Mylapore",
    type: "retail",
    coordinates: [80.269, 13.033],
    ambientOffsetC: 0.5,
    refrigeration: null,
    description: "Heritage neighbourhood — strong morning fish and vegetable trade.",
  },
  {
    id: "adyar",
    name: "Adyar",
    type: "retail",
    coordinates: [80.257, 13.006],
    ambientOffsetC: 0.0, // greener, river-mouth breeze
    refrigeration: null,
    description: "Residential south — steady dairy and produce demand.",
  },
  {
    id: "anna-nagar",
    name: "Anna Nagar",
    type: "retail",
    coordinates: [80.21, 13.085],
    ambientOffsetC: 1.0,
    refrigeration: null,
    description: "Planned northern residential hub — large daily market demand.",
  },
  {
    id: "velachery",
    name: "Velachery",
    type: "retail",
    coordinates: [80.221, 12.979],
    ambientOffsetC: 1.0,
    refrigeration: null,
    description:
      "Fast-growing southern zone on former marshland — notoriously flood-prone.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Edges (directed, along the flow: source → hub → retail, plus inter-hub and
// direct source→retail alternates). Pairs with two edges model main road vs
// longer/warmer alternate for monsoon rerouting.
// ─────────────────────────────────────────────────────────────────────────────

export const CHENNAI_EDGES: CityEdge[] = [
  // ── Source → hub ──────────────────────────────────────────────────────────
  { id: "koyambedu_ambattur", from: "koyambedu", to: "hub-ambattur", travelTimeMin: 25, distanceKm: 7, ambientOffsetC: 0.5, floodProne: false },
  { id: "koyambedu_guindy", from: "koyambedu", to: "hub-guindy", travelTimeMin: 35, distanceKm: 9, ambientOffsetC: 1.0, floodProne: false },
  { id: "koyambedu_perambur", from: "koyambedu", to: "hub-perambur", travelTimeMin: 30, distanceKm: 8, ambientOffsetC: 1.0, floodProne: false },
  { id: "kasimedu_perambur", from: "kasimedu", to: "hub-perambur", travelTimeMin: 30, distanceKm: 9, ambientOffsetC: -0.5, floodProne: false },
  { id: "aavin_perambur", from: "aavin-madhavaram", to: "hub-perambur", travelTimeMin: 18, distanceKm: 5, ambientOffsetC: 0.5, floodProne: false },
  { id: "aavin_ambattur", from: "aavin-madhavaram", to: "hub-ambattur", travelTimeMin: 35, distanceKm: 11, ambientOffsetC: 0.5, floodProne: false },

  // ── Direct source → retail (fast, unrefrigerated-corridor alternates) ─────
  { id: "koyambedu_annanagar", from: "koyambedu", to: "anna-nagar", travelTimeMin: 15, distanceKm: 3.5, ambientOffsetC: 1.5, floodProne: false },
  { id: "koyambedu_tnagar", from: "koyambedu", to: "t-nagar", travelTimeMin: 28, distanceKm: 6.5, ambientOffsetC: 1.5, floodProne: false },
  // Coastal road past the port — low-lying, closes in monsoon floods.
  { id: "kasimedu_mylapore_coastal", from: "kasimedu", to: "mylapore", travelTimeMin: 45, distanceKm: 13, ambientOffsetC: -1.0, floodProne: true },

  // ── Hub → retail ──────────────────────────────────────────────────────────
  { id: "perambur_annanagar", from: "hub-perambur", to: "anna-nagar", travelTimeMin: 20, distanceKm: 5, ambientOffsetC: 1.0, floodProne: false },
  { id: "perambur_tnagar", from: "hub-perambur", to: "t-nagar", travelTimeMin: 40, distanceKm: 10, ambientOffsetC: 1.5, floodProne: false },
  { id: "perambur_mylapore", from: "hub-perambur", to: "mylapore", travelTimeMin: 45, distanceKm: 12, ambientOffsetC: 0.5, floodProne: false },
  { id: "guindy_tnagar", from: "hub-guindy", to: "t-nagar", travelTimeMin: 20, distanceKm: 5.5, ambientOffsetC: 1.0, floodProne: false },
  { id: "guindy_mylapore", from: "hub-guindy", to: "mylapore", travelTimeMin: 30, distanceKm: 8.5, ambientOffsetC: 0.5, floodProne: false },
  // Adyar main road crosses the Adyar river — closes in floods; OMR-side alternate is longer.
  { id: "guindy_adyar_main", from: "hub-guindy", to: "adyar", travelTimeMin: 22, distanceKm: 6, ambientOffsetC: 0.0, floodProne: true },
  { id: "guindy_adyar_omr", from: "hub-guindy", to: "adyar", travelTimeMin: 30, distanceKm: 8, ambientOffsetC: 0.5, floodProne: false },
  // Velachery main road floods notoriously; Taramani loop is longer and hotter.
  { id: "guindy_velachery_main", from: "hub-guindy", to: "velachery", travelTimeMin: 16, distanceKm: 4.5, ambientOffsetC: 1.0, floodProne: true },
  { id: "guindy_velachery_taramani", from: "hub-guindy", to: "velachery", travelTimeMin: 28, distanceKm: 7, ambientOffsetC: 1.5, floodProne: false },
  { id: "ambattur_annanagar", from: "hub-ambattur", to: "anna-nagar", travelTimeMin: 25, distanceKm: 7, ambientOffsetC: 1.0, floodProne: false },

  // ── Inter-hub transfer ────────────────────────────────────────────────────
  { id: "perambur_guindy", from: "hub-perambur", to: "hub-guindy", travelTimeMin: 50, distanceKm: 14, ambientOffsetC: 1.0, floodProne: false },
  { id: "ambattur_perambur", from: "hub-ambattur", to: "hub-perambur", travelTimeMin: 30, distanceKm: 9, ambientOffsetC: 0.5, floodProne: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

const NODE_BY_ID = new Map(CHENNAI_NODES.map((n) => [n.id, n]));
const EDGE_BY_ID = new Map(CHENNAI_EDGES.map((e) => [e.id, e]));

export function getNode(id: string): CityNode {
  const node = NODE_BY_ID.get(id);
  if (!node) throw new Error(`Unknown city node: ${id}`);
  return node;
}

export function getEdge(id: string): CityEdge {
  const edge = EDGE_BY_ID.get(id);
  if (!edge) throw new Error(`Unknown city edge: ${id}`);
  return edge;
}

/** All edges departing a node. */
export function edgesFrom(nodeId: string): CityEdge[] {
  return CHENNAI_EDGES.filter((e) => e.from === nodeId);
}

/** All node ids reachable from any of startIds following directed edges, optionally skipping flood-prone roads. */
export function reachableFrom(
  startIds: string[],
  opts: { excludeFloodProne?: boolean } = {}
): Set<string> {
  const seen = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const e of edgesFrom(current)) {
      if (opts.excludeFloodProne && e.floodProne) continue;
      if (!seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return seen;
}

/**
 * Shortest route (by travel time) from one node to another as an ordered list
 * of edge ids. Returns [] if from === to, or null if no route exists under the
 * given constraints. Dijkstra over travelTimeMin.
 *
 * closedEdgeIds / excludeFloodProne let the Phase 5 monsoon scenario force a
 * reroute by removing roads — the dual main/alternate edges guarantee a path
 * still exists (asserted in chennai.test.ts).
 */
export function planRoute(
  fromId: string,
  toId: string,
  opts: { closedEdgeIds?: string[]; excludeFloodProne?: boolean } = {}
): string[] | null {
  if (fromId === toId) return [];
  const closed = new Set(opts.closedEdgeIds ?? []);
  const dist = new Map<string, number>([[fromId, 0]]);
  const prevEdge = new Map<string, CityEdge>();
  const visited = new Set<string>();
  const frontier: { id: string; d: number }[] = [{ id: fromId, d: 0 }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.d - b.d);
    const { id, d } = frontier.shift() as { id: string; d: number };
    if (visited.has(id)) continue;
    visited.add(id);
    if (id === toId) break;
    for (const e of edgesFrom(id)) {
      if (closed.has(e.id)) continue;
      if (opts.excludeFloodProne && e.floodProne) continue;
      const nd = d + e.travelTimeMin;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prevEdge.set(e.to, e);
        frontier.push({ id: e.to, d: nd });
      }
    }
  }

  if (!prevEdge.has(toId)) return null;
  const route: string[] = [];
  let cur = toId;
  while (cur !== fromId) {
    const e = prevEdge.get(cur);
    if (!e) return null;
    route.unshift(e.id);
    cur = e.from;
  }
  return route;
}
