import { describe, expect, it } from "vitest";
import { CHENNAI_NODES, getNode, planRoute, planRouteOptions } from "./chennai";

/**
 * Regional expansion (Chennai → Tamil Nadu satellite cities). These tests are
 * the verification checklist from the expansion spec: the new geography must be
 * routable from the existing Chennai network without breaking any Chennai route.
 */

const sources = CHENNAI_NODES.filter((n) => n.type === "source");
const hubs = CHENNAI_NODES.filter((n) => n.type === "hub");
const retail = CHENNAI_NODES.filter((n) => n.type === "retail");

const NEW_NODE_IDS = [
  "kanchipuram-mandi", "hub-kanchipuram", "kanchipuram-silk-market",
  "vellore-agri", "hub-vellore", "vellore-cmc", "vellore-fort",
  "puducherry-harbour", "auroville-farm", "hub-puducherry", "puducherry-main",
  "mahabalipuram-fish", "mahabalipuram-market",
  "chengalpattu-wholesale", "hub-chengalpattu", "chengalpattu-market",
  "hub-sriperumbudur", "sriperumbudur-retail",
];

describe("regional expansion — node inventory", () => {
  it("adds all 18 satellite-city nodes with the expected type mix", () => {
    for (const id of NEW_NODE_IDS) {
      expect(() => getNode(id), `missing node ${id}`).not.toThrow();
    }
    // 4 + 6 = 10 sources, 3 + 5 = 8 hubs, 8 + 7 = 15 retail.
    expect(sources.length).toBe(10);
    expect(hubs.length).toBe(8);
    expect(retail.length).toBe(15);
  });
});

describe("regional expansion — long-distance routing", () => {
  const routable: [string, string][] = [
    ["koyambedu", "vellore-cmc"],
    ["kasimedu", "vellore-cmc"],
    ["koyambedu", "puducherry-main"],
    ["koyambedu", "mahabalipuram-market"],
    ["koyambedu", "chengalpattu-market"],
    ["koyambedu", "kanchipuram-silk-market"],
    ["koyambedu", "sriperumbudur-retail"],
    ["aavin-madhavaram", "vellore-fort"],
  ];

  it.each(routable)("planRoute(%s → %s) returns a valid route", (from, to) => {
    const route = planRoute(from, to);
    expect(route, `${from} → ${to} unreachable`).not.toBeNull();
    expect((route as string[]).length).toBeGreaterThan(0);
  });

  it("does NOT break existing Chennai routes", () => {
    expect(planRoute("koyambedu", "mylapore")).not.toBeNull();
    expect(planRoute("kasimedu", "t-nagar")).not.toBeNull();
    expect(planRoute("aavin-madhavaram", "velachery")).not.toBeNull();
  });

  it("planRouteOptions still produces options into the region", () => {
    const opts = planRouteOptions("koyambedu", "puducherry-main", { hourOfDay: 10 });
    expect(opts.length).toBeGreaterThan(0);
    expect(opts[0].estimatedHours).toBeGreaterThan(0);
  });
});

describe("regional expansion — monsoon resilience", () => {
  it("regional retail stays reachable with flood-prone roads excluded", () => {
    for (const to of ["puducherry-main", "mahabalipuram-market", "chengalpattu-market", "vellore-cmc"]) {
      const route = planRoute("koyambedu", to, { excludeFloodProne: true });
      expect(route, `${to} cut off in monsoon`).not.toBeNull();
    }
  });
});
