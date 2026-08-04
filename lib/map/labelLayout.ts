/**
 * Google-Maps-style label decluttering for the twin map.
 *
 * PRESENTATION ONLY — this module decides which POI *text labels* are drawn and
 * where. It never touches the engine, the city graph, or any simulation state
 * (RULE 1: `lib/engine/` stays pure; this is a sibling concern). Marker glyphs
 * are always drawn by the caller at every zoom; only labels are managed here.
 *
 * Two mechanisms, in order:
 *   1. ZOOM TIERING — each POI has an importance tier; a tier's labels only
 *      become eligible at/above `TIER_MIN_ZOOM[tier]`.
 *   2. COLLISION RESOLUTION — eligible labels are placed greedily in priority
 *      order (tier, then proximity to the viewport centre). Each label tries
 *      four anchor positions (below / above / right / left) and takes the first
 *      that hits nothing already placed; if all four collide, it is dropped.
 *
 * Pure and deterministic: identical inputs always yield an identical layout
 * (RULE 4), which is what makes it unit-testable without a GL context.
 */

import type { CityNode } from "@/lib/city/chennai";

// ─── Tuning constants (no magic numbers in the logic below) ──────────────────

export type LabelTier = 1 | 2 | 3;

/**
 * Minimum map zoom at which a tier's labels become eligible.
 *
 * Tuned to this dataset rather than to generic web-map defaults: the twin opens
 * at z8.3 showing the whole ~300 km Tamil Nadu network, so tier 1 must be live
 * at the default view, and the regional anchors (Vellore / Kanchipuram /
 * Chengalpattu / Puducherry) need to appear well before the Chennai-metro zoom.
 */
export const TIER_MIN_ZOOM: Record<LabelTier, number> = {
  1: 7.0, // regional anchors — ports, the wholesale market, the metro cold hubs
  2: 9.6, // district-level sources, regional cold hubs, major retail markets
  3: 11.4, // neighbourhood retail, urban farms, community kitchens
};

/** Font metrics of the label TextLayer — must match the layer props. */
export const LABEL_FONT_SIZE_PX = 11;
export const LABEL_PADDING_X = 5;
export const LABEL_PADDING_Y = 3;

/** Monospace advance width as a fraction of font size (slightly conservative). */
export const LABEL_CHAR_ASPECT = 0.62;

/** Breathing room enforced between two placed labels. */
export const LABEL_GAP_PX = 3;

/** Distance from the marker glyph edge to the label box. */
export const LABEL_ANCHOR_GAP_PX = 6;

/** Nodes this far outside the viewport are not considered for labelling. */
export const LABEL_VIEWPORT_MARGIN_PX = 64;

/** Fade duration when a label appears or disappears (ms). */
export const LABEL_FADE_MS = 180;

/**
 * Glyph box relative to its `radiusPx`: the marker TextLayer renders at
 * `radiusPx * 2.8` px, and a single glyph is narrower than it is tall.
 */
const GLYPH_SIZE_FACTOR = 2.8;
const GLYPH_WIDTH_FACTOR = 0.7;

// ─── Importance tiers ────────────────────────────────────────────────────────

/**
 * Explicit per-POI importance. Anything not listed falls back to `inferTier`,
 * so new nodes added to the graph get a sensible tier automatically.
 *
 * UNCERTAIN — flagged for the developer rather than silently guessed:
 *   - `auroville-farm` ("Auroville Organic Farm"): named a farm, but it is a
 *     network *source* and the only inland supplier of the Puducherry cluster.
 *     Tiered 2 (not 3) so it does not vanish at regional zoom; demote if it is
 *     meant to read as a smallholding.
 *   - `mahabalipuram-fish` ("Mahabalipuram Fish Landing"): a landing, not a
 *     harbour — tiered 2 rather than 1 alongside Kasimedu / Puducherry.
 *   - `chengalpattu-wholesale`: the type heuristic would call any wholesale
 *     market tier 1; pinned to 2 here to match the brief's explicit list.
 */
const EXPLICIT_TIER: Readonly<Record<string, LabelTier>> = {
  // Tier 1 — always visible, even zoomed all the way out.
  "ennore-port": 1,
  kasimedu: 1,
  koyambedu: 1,
  "puducherry-harbour": 1,
  "hub-ambattur": 1,
  "hub-perambur": 1,
  "hub-guindy": 1,

  // Tier 2 — mid-importance, from medium zoom.
  "aavin-madhavaram": 2,
  "chengalpattu-wholesale": 2,
  "mahabalipuram-fish": 2,
  "mahabalipuram-market": 2,
  "puducherry-main": 2,
  "auroville-farm": 2,
  // The two biggest Chennai retail markets outrank the other neighbourhoods.
  "t-nagar": 2,
  "anna-nagar": 2,
};

/** Names that mark a source as a regional anchor rather than a district yard. */
const MAJOR_SOURCE_PATTERN = /\b(port|harbour|harbor)\b|wholesale market/i;

/** Tier for a POI with no explicit entry, inferred from its type and name. */
function inferTier(node: CityNode): LabelTier {
  switch (node.type) {
    case "source":
      return MAJOR_SOURCE_PATTERN.test(node.name) ? 1 : 2;
    case "hub":
      // Regional cold hubs; the three metro hubs are pinned to tier 1 above.
      return 2;
    case "retail":
    case "urban_farm":
    case "community_kitchen":
      return 3;
  }
}

/** Importance tier of a POI. Lower number = higher priority. */
export function tierForNode(node: CityNode): LabelTier {
  return EXPLICIT_TIER[node.id] ?? inferTier(node);
}

// ─── Geometry ────────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelPlacement {
  /** Pixel offset from the node's projected position. */
  offset: [number, number];
  anchor: "start" | "middle" | "end";
  baseline: "top" | "center" | "bottom";
}

/** Minimal slice of a deck.gl Viewport — keeps this module GL-free. */
export interface LabelViewport {
  width: number;
  height: number;
  project(coordinates: number[]): number[];
}

export interface LayoutLabelsOptions {
  nodes: readonly CityNode[];
  viewport: LabelViewport;
  zoom: number;
  /** Marker glyph radius in pixels, by node (from NODE_TYPE_STYLE). */
  glyphRadiusPx: (node: CityNode) => number;
}

/** Node id → where its label goes. Absent id = label hidden at this view. */
export type LabelLayout = ReadonlyMap<string, LabelPlacement>;

/**
 * Shared "nothing labelled" layout. Exported because `DeckMap` imports
 * react-map-gl's `Map` component, which shadows the global `Map` constructor.
 */
export const EMPTY_LABEL_LAYOUT: LabelLayout = new Map<string, LabelPlacement>();

/** On-screen size of a label box, including its background padding. */
export function labelBoxSize(name: string): { w: number; h: number } {
  return {
    w: name.length * LABEL_FONT_SIZE_PX * LABEL_CHAR_ASPECT + LABEL_PADDING_X * 2,
    h: LABEL_FONT_SIZE_PX + LABEL_PADDING_Y * 2,
  };
}

/** Screen-space box a placement occupies, given the node's projected point. */
export function rectForPlacement(
  x: number,
  y: number,
  box: { w: number; h: number },
  placement: LabelPlacement
): Rect {
  const ax = x + placement.offset[0];
  const ay = y + placement.offset[1];
  const left =
    placement.anchor === "start"
      ? ax
      : placement.anchor === "end"
        ? ax - box.w
        : ax - box.w / 2;
  const top =
    placement.baseline === "top"
      ? ay
      : placement.baseline === "bottom"
        ? ay - box.h
        : ay - box.h / 2;
  return { x: left, y: top, w: box.w, h: box.h };
}

/** The default placement (directly below the glyph) used by hidden labels. */
export function defaultPlacement(radiusPx: number): LabelPlacement {
  return {
    offset: [0, radiusPx + LABEL_ANCHOR_GAP_PX],
    anchor: "middle",
    baseline: "top",
  };
}

/**
 * Candidate placements in preference order: below (the historical position),
 * then above, right, left — the same fallback ladder web maps use.
 */
function candidatePlacements(radiusPx: number): LabelPlacement[] {
  const gap = radiusPx + LABEL_ANCHOR_GAP_PX;
  return [
    { offset: [0, gap], anchor: "middle", baseline: "top" },
    { offset: [0, -gap], anchor: "middle", baseline: "bottom" },
    { offset: [gap, 0], anchor: "start", baseline: "center" },
    { offset: [-gap, 0], anchor: "end", baseline: "center" },
  ];
}

/** Axis-aligned bounding-box overlap test. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

interface Candidate {
  node: CityNode;
  tier: LabelTier;
  x: number;
  y: number;
  radiusPx: number;
  distFromCentre: number;
}

interface GlyphObstacle extends Rect {
  nodeId: string;
}

/**
 * Decide which labels are drawn and where, for one view state.
 *
 * Marker glyphs are treated as fixed obstacles (they are always drawn), so a
 * label never lands on top of a neighbouring marker — a node's own glyph is
 * excluded, since its label is anchored to it by design.
 */
export function layoutLabels(options: LayoutLabelsOptions): LabelLayout {
  const { nodes, viewport, zoom, glyphRadiusPx } = options;
  const layout = new Map<string, LabelPlacement>();
  if (!(viewport.width > 0) || !(viewport.height > 0)) return layout;

  const centreX = viewport.width / 2;
  const centreY = viewport.height / 2;
  const candidates: Candidate[] = [];
  const glyphs: GlyphObstacle[] = [];

  for (const node of nodes) {
    const projected = viewport.project(node.coordinates);
    const x = projected[0];
    const y = projected[1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const radiusPx = glyphRadiusPx(node);
    const glyphH = radiusPx * GLYPH_SIZE_FACTOR;
    const glyphW = glyphH * GLYPH_WIDTH_FACTOR;
    glyphs.push({
      nodeId: node.id,
      x: x - glyphW / 2,
      y: y - glyphH / 2,
      w: glyphW,
      h: glyphH,
    });

    const m = LABEL_VIEWPORT_MARGIN_PX;
    const offscreen =
      x < -m || y < -m || x > viewport.width + m || y > viewport.height + m;
    if (offscreen) continue;

    const tier = tierForNode(node);
    if (zoom < TIER_MIN_ZOOM[tier]) continue;

    candidates.push({
      node,
      tier,
      x,
      y,
      radiusPx,
      distFromCentre: Math.hypot(x - centreX, y - centreY),
    });
  }

  // Priority: importance first, then closeness to what the operator is looking
  // at; node id last so the result is stable when the first two tie (RULE 4).
  candidates.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.distFromCentre - b.distFromCentre ||
      (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0)
  );

  const placed: Rect[] = [];
  for (const candidate of candidates) {
    const box = labelBoxSize(candidate.node.name);
    for (const placement of candidatePlacements(candidate.radiusPx)) {
      const rect = rectForPlacement(candidate.x, candidate.y, box, placement);
      const test = inflate(rect, LABEL_GAP_PX);

      let blocked = false;
      for (const glyph of glyphs) {
        if (glyph.nodeId !== candidate.node.id && rectsOverlap(test, glyph)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        for (const other of placed) {
          if (rectsOverlap(test, other)) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        placed.push(rect);
        layout.set(candidate.node.id, placement);
        break;
      }
    }
  }

  return layout;
}
