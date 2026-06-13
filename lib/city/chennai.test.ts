import { describe, expect, it } from "vitest";
import {
  CHENNAI_BOUNDS,
  CHENNAI_EDGES,
  CHENNAI_NODES,
  CITY_BASELINE_C,
  DIURNAL_PEAK_HOUR,
  cityAmbientC,
  edgeAmbientC,
  edgesFrom,
  getNode,
  haversineKm,
  nodeAmbientC,
  nodeHoldingTempC,
  reachableFrom,
} from "./chennai";
import { PRODUCE_IDS } from "../engine/produce";

const nodeIds = new Set(CHENNAI_NODES.map((n) => n.id));
const sources = CHENNAI_NODES.filter((n) => n.type === "source");
const hubs = CHENNAI_NODES.filter((n) => n.type === "hub");
const retail = CHENNAI_NODES.filter((n) => n.type === "retail");
const sourceIds = sources.map((n) => n.id);

describe("identity integrity", () => {
  it("node ids are unique", () => {
    expect(nodeIds.size).toBe(CHENNAI_NODES.length);
  });

  it("edge ids are unique", () => {
    const ids = new Set(CHENNAI_EDGES.map((e) => e.id));
    expect(ids.size).toBe(CHENNAI_EDGES.length);
  });

  it("every edge references existing nodes and is not a self-loop", () => {
    for (const e of CHENNAI_EDGES) {
      expect(nodeIds.has(e.from), `edge ${e.id}: unknown from '${e.from}'`).toBe(true);
      expect(nodeIds.has(e.to), `edge ${e.id}: unknown to '${e.to}'`).toBe(true);
      expect(e.from).not.toBe(e.to);
    }
  });
});

describe("geographic integrity (spec §6 bounding box)", () => {
  it("all coordinates fall within Chennai (~12.8–13.3 N, 80.1–80.35 E)", () => {
    for (const n of CHENNAI_NODES) {
      const [lon, lat] = n.coordinates;
      expect(lat, `${n.id} latitude`).toBeGreaterThanOrEqual(CHENNAI_BOUNDS.minLat);
      expect(lat, `${n.id} latitude`).toBeLessThanOrEqual(CHENNAI_BOUNDS.maxLat);
      expect(lon, `${n.id} longitude`).toBeGreaterThanOrEqual(CHENNAI_BOUNDS.minLon);
      expect(lon, `${n.id} longitude`).toBeLessThanOrEqual(CHENNAI_BOUNDS.maxLon);
    }
  });

  it("spec anchor locations sit at their approximate real coordinates", () => {
    expect(getNode("koyambedu").coordinates[1]).toBeCloseTo(13.069, 2);
    expect(getNode("koyambedu").coordinates[0]).toBeCloseTo(80.194, 2);
    expect(getNode("kasimedu").coordinates[1]).toBeCloseTo(13.124, 2);
    expect(getNode("aavin-madhavaram").coordinates[1]).toBeCloseTo(13.148, 2);
  });
});

describe("node validity (type + ambient value)", () => {
  it("every node has a valid type", () => {
    for (const n of CHENNAI_NODES) {
      expect(["source", "hub", "retail", "urban_farm", "community_kitchen"]).toContain(n.type);
    }
  });

  it("every node has a finite, plausible ambient offset (|offset| ≤ 3 °C)", () => {
    for (const n of CHENNAI_NODES) {
      expect(Number.isFinite(n.ambientOffsetC), `${n.id} ambientOffsetC`).toBe(true);
      expect(Math.abs(n.ambientOffsetC)).toBeLessThanOrEqual(3);
    }
  });

  it("refrigerated nodes have cold-chain setpoints in 0–10 °C", () => {
    for (const n of CHENNAI_NODES) {
      if (n.refrigeration) {
        expect(n.refrigeration.setpointC).toBeGreaterThanOrEqual(0);
        expect(n.refrigeration.setpointC).toBeLessThanOrEqual(10);
      }
    }
  });

  it("all hubs are refrigerated; sources have non-empty handles", () => {
    for (const h of hubs) expect(h.refrigeration).not.toBeNull();
    for (const s of sources) expect(s.handles && s.handles.length).toBeTruthy();
  });

  it("every §5.3 produce is handled by at least one source", () => {
    const handled = new Set(sources.flatMap((s) => s.handles ?? []));
    for (const id of PRODUCE_IDS) {
      expect(handled.has(id), `no source handles '${id}'`).toBe(true);
    }
  });

  it("expected source→produce mapping (Koyambedu produce, Kasimedu fish, Aavin dairy)", () => {
    expect(getNode("koyambedu").handles).toEqual(
      expect.arrayContaining(["tomato", "mango", "banana", "leafyVeg"])
    );
    expect(getNode("kasimedu").handles).toEqual(["fish"]);
    expect(getNode("aavin-madhavaram").handles).toEqual(
      expect.arrayContaining(["milk", "paneer"])
    );
  });
});

describe("edge realism", () => {
  it("road distance is between 1× and 3× the straight-line distance", () => {
    for (const e of CHENNAI_EDGES) {
      const straight = haversineKm(getNode(e.from).coordinates, getNode(e.to).coordinates);
      expect(e.distanceKm, `edge ${e.id} shorter than straight line`).toBeGreaterThanOrEqual(straight * 0.99);
      expect(e.distanceKm, `edge ${e.id} unrealistically winding`).toBeLessThanOrEqual(straight * 3);
    }
  });

  it("implied speeds are plausible Chennai traffic (8–40 km/h)", () => {
    for (const e of CHENNAI_EDGES) {
      const speedKmh = e.distanceKm / (e.travelTimeMin / 60);
      expect(speedKmh, `edge ${e.id} speed ${speedKmh.toFixed(1)} km/h`).toBeGreaterThanOrEqual(8);
      expect(speedKmh, `edge ${e.id} speed ${speedKmh.toFixed(1)} km/h`).toBeLessThanOrEqual(40);
    }
  });

  it("edge ambient offsets are finite and |offset| ≤ 3 °C", () => {
    for (const e of CHENNAI_EDGES) {
      expect(Number.isFinite(e.ambientOffsetC)).toBe(true);
      expect(Math.abs(e.ambientOffsetC)).toBeLessThanOrEqual(3);
    }
  });
});

describe("network connectivity", () => {
  it("every source has at least one outgoing edge", () => {
    for (const s of sources) {
      expect(edgesFrom(s.id).length, `source ${s.id}`).toBeGreaterThan(0);
    }
  });

  it("every hub has at least one incoming and one outgoing edge", () => {
    for (const h of hubs) {
      const incoming = CHENNAI_EDGES.filter((e) => e.to === h.id);
      expect(incoming.length, `hub ${h.id} incoming`).toBeGreaterThan(0);
      expect(edgesFrom(h.id).length, `hub ${h.id} outgoing`).toBeGreaterThan(0);
    }
  });

  it("every retail zone is reachable from at least one source", () => {
    const reachable = reachableFrom(sourceIds);
    for (const r of retail) {
      expect(reachable.has(r.id), `retail ${r.id} unreachable`).toBe(true);
    }
  });

  it("monsoon resilience: with flood-prone roads closed, all retail stays reachable", () => {
    // Guarantees the Phase 5 flood scenario is winnable by rerouting.
    const reachable = reachableFrom(sourceIds, { excludeFloodProne: true });
    for (const r of retail) {
      expect(reachable.has(r.id), `retail ${r.id} cut off in flood`).toBe(true);
    }
  });

  it("at least one flood-prone edge exists (the flood scenario has roads to close)", () => {
    expect(CHENNAI_EDGES.some((e) => e.floodProne)).toBe(true);
  });
});

describe("ambient temperature profile", () => {
  it("city baseline diurnal cycle stays within Chennai's 28–36 °C at zero offset", () => {
    for (let h = 0; h <= 24; h += 0.5) {
      const t = cityAmbientC(h);
      expect(t).toBeGreaterThanOrEqual(28 - 1e-9);
      expect(t).toBeLessThanOrEqual(36 + 1e-9);
    }
  });

  it("peaks mid-afternoon and bottoms out pre-dawn", () => {
    expect(cityAmbientC(DIURNAL_PEAK_HOUR)).toBeCloseTo(CITY_BASELINE_C + 4, 9);
    expect(cityAmbientC(DIURNAL_PEAK_HOUR - 12)).toBeCloseTo(CITY_BASELINE_C - 4, 9);
    expect(cityAmbientC(DIURNAL_PEAK_HOUR)).toBeGreaterThan(cityAmbientC(4));
  });

  it("scenario override shifts the whole profile (heatwave +5 ⇒ 41 °C peak)", () => {
    expect(cityAmbientC(DIURNAL_PEAK_HOUR, 5)).toBeCloseTo(41, 9);
    for (let h = 0; h <= 24; h += 1) {
      expect(cityAmbientC(h, 5)).toBeCloseTo(cityAmbientC(h) + 5, 9);
    }
  });

  it("node and edge ambients apply their microclimate offsets", () => {
    const tNagar = getNode("t-nagar");
    expect(nodeAmbientC(tNagar, 12)).toBeCloseTo(cityAmbientC(12) + 2.0, 9);
    const coastal = CHENNAI_EDGES.find((e) => e.id === "kasimedu_mylapore_coastal");
    expect(coastal).toBeDefined();
    if (coastal) {
      expect(edgeAmbientC(coastal, 12)).toBeCloseTo(cityAmbientC(12) - 1.0, 9);
    }
  });

  it("refrigerated nodes hold their setpoint; unrefrigerated nodes track ambient", () => {
    const aavin = getNode("aavin-madhavaram");
    expect(nodeHoldingTempC(aavin, 14.5, 6)).toBe(4); // heatwave can't touch the cold room
    const koyambedu = getNode("koyambedu");
    expect(nodeHoldingTempC(koyambedu, 14.5)).toBeCloseTo(36 + 1.5, 9);
  });
});
