import { describe, expect, it } from "vitest";
import { analyzeFleet, buildCopilotContext, remainingTravelHours } from "./heuristics";
import {
  createSimulation,
  dispatchShipment,
  stepSimulation,
} from "../engine/simulation";

function run(state = createSimulation(7)) {
  return state;
}

describe("copilot heuristics (free fallback)", () => {
  it("an empty fleet yields a calm summary and no critical advice", () => {
    const report = analyzeFleet(run());
    expect(report.atRisk).toBe(0);
    expect(report.advice.every((a) => a.severity !== "critical")).toBe(true);
    expect(report.summary).toMatch(/no shipments/i);
  });

  it("warns about a heatwave and flagging fragile cargo", () => {
    let s = createSimulation(7);
    s = { ...s, scenarioOffsetC: 8 };
    const report = analyzeFleet(s);
    expect(report.advice.some((a) => a.id === "city-heatwave")).toBe(true);
  });

  it("flags an ambient milk run in a heatwave as critical (will spoil)", () => {
    let s = createSimulation(7);
    s = { ...s, scenarioOffsetC: 8 };
    s = dispatchShipment(s, {
      produce: "milk",
      fromId: "aavin-madhavaram",
      toId: "velachery",
    });
    // step a little so it's mid-route and degrading (still in transit)
    for (let i = 0; i < 12; i++) s = stepSimulation(s, 0.05);
    expect(s.shipments[0].status).toBe("in-transit");
    const report = analyzeFleet(s);
    expect(report.advice.some((a) => a.severity === "critical")).toBe(true);
    expect(report.atRisk).toBeGreaterThan(0);
  });

  it("a chilled fish run on a normal day is not critical", () => {
    let s = createSimulation(7);
    s = dispatchShipment(s, {
      produce: "fish",
      fromId: "kasimedu",
      toId: "mylapore",
      transportSetpointC: 2,
    });
    for (let i = 0; i < 10; i++) s = stepSimulation(s, 0.05);
    const report = analyzeFleet(s);
    expect(report.advice.some((a) => a.id === "S1-willspoil")).toBe(false);
  });

  it("remainingTravelHours is positive mid-route and shrinks as it travels", () => {
    let s = createSimulation(7);
    s = dispatchShipment(s, { produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    const start = remainingTravelHours(s.shipments[0]);
    for (let i = 0; i < 5; i++) s = stepSimulation(s, 0.05);
    const later = remainingTravelHours(s.shipments[0]);
    expect(start).toBeGreaterThan(0);
    expect(later).toBeLessThan(start);
  });

  it("buildCopilotContext lists shipments with their numbers", () => {
    let s = createSimulation(7);
    s = dispatchShipment(s, { produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    s = stepSimulation(s, 0.1);
    const ctx = buildCopilotContext(s);
    expect(ctx).toMatch(/Fish S1/);
    expect(ctx).toMatch(/life left/);
  });

  it("is deterministic", () => {
    const build = () => {
      let s = createSimulation(7);
      s = { ...s, scenarioOffsetC: 6 };
      s = dispatchShipment(s, { produce: "milk", fromId: "aavin-madhavaram", toId: "velachery" });
      for (let i = 0; i < 20; i++) s = stepSimulation(s, 0.05);
      return analyzeFleet(s);
    };
    expect(build()).toEqual(build());
  });
});
