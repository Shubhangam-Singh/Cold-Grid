import { describe, expect, it } from "vitest";

import { CHENNAI_NODES, type CityNode } from "@/lib/city/chennai";
import {
  LABEL_GAP_PX,
  TIER_MIN_ZOOM,
  labelBoxSize,
  layoutLabels,
  rectForPlacement,
  rectsOverlap,
  tierForNode,
  type LabelViewport,
  type Rect,
} from "@/lib/map/labelLayout";
import { NODE_TYPE_STYLE } from "@/components/twin/colors";

const glyphRadiusPx = (n: CityNode) => NODE_TYPE_STYLE[n.type].radiusPx;

/**
 * A linear stand-in for WebMercatorViewport: enough to place points on screen
 * deterministically without a GL context. `pxPerDeg` stands in for zoom.
 */
function fakeViewport(
  pxPerDeg: number,
  centre: [number, number] = [80.2, 13.05],
  width = 1200,
  height = 800
): LabelViewport {
  return {
    width,
    height,
    project(coordinates: number[]): number[] {
      return [
        width / 2 + (coordinates[0] - centre[0]) * pxPerDeg,
        height / 2 - (coordinates[1] - centre[1]) * pxPerDeg,
      ];
    },
  };
}

function node(over: Partial<CityNode> & { id: string }): CityNode {
  return {
    name: over.id,
    type: "retail",
    coordinates: [80.2, 13.05],
    ambientOffsetC: 0,
    refrigeration: null,
    ...over,
  } as CityNode;
}

/** Every rect a layout actually paints, recomputed from its placements. */
function rectsOf(
  layout: ReturnType<typeof layoutLabels>,
  nodes: readonly CityNode[],
  viewport: LabelViewport
): Rect[] {
  const out: Rect[] = [];
  for (const n of nodes) {
    const placement = layout.get(n.id);
    if (!placement) continue;
    const p = viewport.project(n.coordinates);
    out.push(rectForPlacement(p[0], p[1], labelBoxSize(n.name), placement));
  }
  return out;
}

describe("importance tiers", () => {
  it("puts ports, the wholesale market and the metro cold hubs in tier 1", () => {
    for (const id of [
      "ennore-port",
      "kasimedu",
      "koyambedu",
      "puducherry-harbour",
      "hub-ambattur",
      "hub-perambur",
      "hub-guindy",
    ]) {
      const n = CHENNAI_NODES.find((c) => c.id === id);
      expect(n, `${id} missing from the graph`).toBeDefined();
      expect(tierForNode(n!), id).toBe(1);
    }
  });

  it("puts regional hubs and district sources in tier 2", () => {
    for (const id of [
      "aavin-madhavaram",
      "hub-vellore",
      "hub-kanchipuram",
      "hub-chengalpattu",
      "chengalpattu-wholesale",
      "mahabalipuram-market",
    ]) {
      const n = CHENNAI_NODES.find((c) => c.id === id);
      expect(n, `${id} missing from the graph`).toBeDefined();
      expect(tierForNode(n!), id).toBe(2);
    }
  });

  it("puts urban farms, community kitchens and minor retail in tier 3", () => {
    for (const n of CHENNAI_NODES) {
      if (n.type === "urban_farm" || n.type === "community_kitchen") {
        expect(tierForNode(n), n.id).toBe(3);
      }
    }
    for (const id of ["mylapore", "velachery", "porur", "vellore-fort"]) {
      const n = CHENNAI_NODES.find((c) => c.id === id);
      expect(tierForNode(n!), id).toBe(3);
    }
  });

  it("assigns every node in the graph a valid tier", () => {
    for (const n of CHENNAI_NODES) {
      expect([1, 2, 3], n.id).toContain(tierForNode(n));
    }
  });
});

describe("zoom gating", () => {
  it("shows only tier-1 labels at the regional default zoom", () => {
    const viewport = fakeViewport(60);
    const layout = layoutLabels({
      nodes: CHENNAI_NODES,
      viewport,
      zoom: 8.3,
      glyphRadiusPx,
    });
    expect(layout.size).toBeGreaterThan(0);
    for (const id of Array.from(layout.keys())) {
      const n = CHENNAI_NODES.find((c) => c.id === id)!;
      expect(tierForNode(n), `${id} should not be labelled at z8.3`).toBe(1);
    }
  });

  it("never labels a tier below its minimum zoom", () => {
    for (const zoom of [7.5, 9.0, 10.5, 12.0, 14.0]) {
      const layout = layoutLabels({
        nodes: CHENNAI_NODES,
        viewport: fakeViewport(200),
        zoom,
        glyphRadiusPx,
      });
      for (const id of Array.from(layout.keys())) {
        const n = CHENNAI_NODES.find((c) => c.id === id)!;
        expect(zoom, `${id} at z${zoom}`).toBeGreaterThanOrEqual(
          TIER_MIN_ZOOM[tierForNode(n)]
        );
      }
    }
  });

  it("reveals progressively more of the network as you zoom in", () => {
    const counts = [8.3, 10.0, 12.0, 14.0].map((zoom) => {
      // Zoom in on the Chennai core so more POIs stay on screen as px/deg grows.
      const viewport = fakeViewport(Math.pow(2, zoom) / 12, [80.22, 13.06]);
      return layoutLabels({
        nodes: CHENNAI_NODES,
        viewport,
        zoom,
        glyphRadiusPx,
      }).size;
    });
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i], `z-step ${i} = ${counts.join(",")}`).toBeGreaterThan(0);
    }
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0]);
  });

  it("draws nothing when no tier is eligible", () => {
    const layout = layoutLabels({
      nodes: CHENNAI_NODES,
      viewport: fakeViewport(60),
      zoom: 4,
      glyphRadiusPx,
    });
    expect(layout.size).toBe(0);
  });
});

describe("collision resolution", () => {
  it("produces no overlapping label boxes at any zoom", () => {
    for (const zoom of [7.5, 8.3, 9.6, 10.5, 11.4, 12.5, 14.0, 16.0]) {
      const viewport = fakeViewport(Math.pow(2, zoom) / 12, [80.22, 13.06]);
      const layout = layoutLabels({
        nodes: CHENNAI_NODES,
        viewport,
        zoom,
        glyphRadiusPx,
      });
      const rects = rectsOf(layout, CHENNAI_NODES, viewport);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(
            rectsOverlap(rects[i], rects[j]),
            `overlap at z${zoom} between rects ${i} and ${j}`
          ).toBe(false);
        }
      }
    }
  });

  it("keeps at least LABEL_GAP_PX between neighbouring labels", () => {
    const viewport = fakeViewport(Math.pow(2, 12) / 12, [80.22, 13.06]);
    const layout = layoutLabels({
      nodes: CHENNAI_NODES,
      viewport,
      zoom: 12,
      glyphRadiusPx,
    });
    const rects = rectsOf(layout, CHENNAI_NODES, viewport);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(LABEL_GAP_PX - 1e-9);
      }
    }
  });

  it("gives the preferred slot to the more important POI", () => {
    // Two nodes at the same point. Both can be labelled — there are four slots
    // — but the tier-1 hub must get the default one directly under the glyph.
    const nodes: CityNode[] = [
      node({
        id: "hub-guindy",
        name: "Guindy Cold Hub",
        type: "hub",
        coordinates: [80.2, 13.05],
      }),
      node({
        id: "farm-velachery",
        name: "Velachery Community Garden",
        type: "urban_farm",
        coordinates: [80.2, 13.05],
      }),
    ];
    const layout = layoutLabels({
      nodes,
      viewport: fakeViewport(100),
      zoom: 15,
      glyphRadiusPx,
    });
    expect(layout.get("hub-guindy")?.baseline).toBe("top");
    expect(layout.get("farm-velachery")?.baseline).not.toBe("top");
  });

  it("drops the least important labels when a cluster cannot fit", () => {
    // One tier-1 hub buried under five tier-3 farms, all at the same point:
    // there are only four slots, so the hub must survive and some farms must not.
    const nodes: CityNode[] = [
      node({
        id: "hub-guindy",
        name: "Guindy Cold Hub",
        type: "hub",
        coordinates: [80.2, 13.05],
      }),
      ...[1, 2, 3, 4, 5].map((i) =>
        node({
          id: `farm-${i}`,
          name: `Community Garden Number ${i}`,
          type: "urban_farm",
          coordinates: [80.2, 13.05],
        })
      ),
    ];
    const layout = layoutLabels({
      nodes,
      viewport: fakeViewport(100),
      zoom: 15,
      glyphRadiusPx,
    });
    expect(layout.has("hub-guindy")).toBe(true);
    expect(layout.size).toBeLessThan(nodes.length);
  });

  it("falls back to an alternate side rather than dropping a label", () => {
    // A second node sits just below the first, blocking the default placement.
    const nodes: CityNode[] = [
      node({ id: "a", name: "AAAA", coordinates: [80.2, 13.05] }),
      node({ id: "b", name: "BBBB", coordinates: [80.2, 13.0495] }),
    ];
    const layout = layoutLabels({
      nodes,
      viewport: fakeViewport(4000),
      zoom: 15,
      glyphRadiusPx,
    });
    expect(layout.size).toBe(2);
    const placements = [layout.get("a")!, layout.get("b")!];
    // They cannot both sit in the default "below" slot.
    expect(placements.filter((p) => p.baseline === "top").length).toBeLessThan(2);
  });

  it("does not drop a lone label onto its own glyph", () => {
    const nodes: CityNode[] = [
      node({ id: "solo", name: "Solo Market", type: "hub" }),
    ];
    const layout = layoutLabels({
      nodes,
      viewport: fakeViewport(100),
      zoom: 15,
      glyphRadiusPx,
    });
    // radiusPx for a hub is 11, so the default slot is 11 + LABEL_ANCHOR_GAP_PX.
    expect(layout.get("solo")).toEqual({
      offset: [0, 17],
      anchor: "middle",
      baseline: "top",
    });
  });
});

describe("determinism and viewport handling", () => {
  it("returns an identical layout for identical inputs (RULE 4)", () => {
    const run = () =>
      layoutLabels({
        nodes: CHENNAI_NODES,
        viewport: fakeViewport(Math.pow(2, 11) / 12, [80.22, 13.06]),
        zoom: 11,
        glyphRadiusPx,
      });
    expect(Array.from(run().entries())).toEqual(Array.from(run().entries()));
  });

  it("labels nothing before the canvas has been measured", () => {
    const layout = layoutLabels({
      nodes: CHENNAI_NODES,
      viewport: fakeViewport(200, [80.2, 13.05], 0, 0),
      zoom: 14,
      glyphRadiusPx,
    });
    expect(layout.size).toBe(0);
  });

  it("ignores POIs panned well off screen", () => {
    const viewport = fakeViewport(400, [80.22, 13.06]);
    const layout = layoutLabels({
      nodes: CHENNAI_NODES,
      viewport,
      zoom: 14,
      glyphRadiusPx,
    });
    for (const id of Array.from(layout.keys())) {
      const n = CHENNAI_NODES.find((c) => c.id === id)!;
      const p = viewport.project(n.coordinates);
      expect(p[0], id).toBeGreaterThan(-100);
      expect(p[0], id).toBeLessThan(viewport.width + 100);
      expect(p[1], id).toBeGreaterThan(-100);
      expect(p[1], id).toBeLessThan(viewport.height + 100);
    }
  });
});
