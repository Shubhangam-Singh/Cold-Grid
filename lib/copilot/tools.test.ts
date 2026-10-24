import { describe, expect, it } from "vitest";
import { createSimulation, dispatchShipment } from "../engine/simulation";
import { describeConfirm } from "./confirm";
import { demoWorld } from "./fixture";
import { buildSessionWorld } from "./sessionWorld";
import { detectExcursion, detectFault, detectTamper } from "./detectors";
import { computeFreshness, getDevice, verifyIntegrity } from "./tools";
import { labelledLedgers, labelledTraces } from "./simulate";

describe("session world", () => {
  it("puts a fresh cart sample on the newest in-transit truck", () => {
    let sim = createSimulation(1, { startHourOfDay: 9 });
    sim = dispatchShipment(sim, { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" });
    const id = sim.shipments[0].id;
    const nowMs = 1_700_000_000_000;
    const world = buildSessionWorld({
      sim,
      listen: true,
      connected: true,
      attachFish: false,
      reading: { tempC: 24.6, humidity: 75, gas: 246, at: nowMs / 1000 - 1 },
      history: [],
      chain: [],
      nowMs,
    });
    expect(world.probe?.shipmentId).toBe(id);
    expect(world.probe?.stale).toBe(false);
    const fresh = computeFreshness(world, id) as { tempC: number; source: string };
    expect(fresh.tempC).toBe(24.6);
    expect(fresh.source).toBe("probe");
  });

  it("leaves the fleet synthetic when the cart is off", () => {
    let sim = createSimulation(1, { startHourOfDay: 9 });
    sim = dispatchShipment(sim, { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" });
    const world = buildSessionWorld({
      sim,
      listen: false,
      connected: false,
      attachFish: false,
      reading: { tempC: 24.6, humidity: 75, gas: 246, at: 1 },
      history: [],
      chain: [],
      nowMs: 10_000,
    });
    expect(world.probe).toBeNull();
    expect(getDevice(world).device).toBeNull();
  });
});

describe("confirm gate", () => {
  it("records a threshold request without applying it", () => {
    const row = describeConfirm({ action: "update_threshold", product: "tomato", minC: 4, maxC: 30 });
    expect(row.applied).toBe(false);
    expect(row.detail).toContain("not changed");
  });

  it("refuses a re-anchor when nothing is anchored", () => {
    const row = describeConfirm({ action: "request_reanchor", anchored: false });
    expect(row.applied).toBe(false);
    expect(row.detail.toLowerCase()).toContain("not anchored");
  });
});

describe("simulator labels", () => {
  it("matches excursion, fault, and tamper labels", () => {
    for (const row of labelledTraces()) {
      expect(row.simulated).toBe(true);
      expect(detectExcursion(row.temps, row.thresholdC)).toBe(row.excursion);
      expect(detectFault(row.temps) !== "ok").toBe(row.fault);
    }
    for (const row of labelledLedgers()) {
      expect(detectTamper(row.blocks, "genesis")).toBe(row.tamper);
    }
  });
});

describe("integrity tool", () => {
  it("reports the demo ledger as not anchored", () => {
    const row = verifyIntegrity(demoWorld());
    expect(row?.summary.toLowerCase()).toContain("not anchored");
  });
});
