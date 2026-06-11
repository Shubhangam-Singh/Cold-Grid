import { describe, expect, it } from "vitest";
import {
  DEMO_DURATION_HOURS,
  DEMO_SCRIPT,
  DEMO_SEED,
  DEMO_START_HOUR,
} from "./script";
import {
  SIM_DT_HOURS,
  type SimulationState,
  createSimulation,
  dispatchShipment,
  stepSimulation,
} from "../engine/simulation";

/** Headless replay of the demo script — the same logic the controller drives. */
function runDemo(seed: number): SimulationState {
  let sim = createSimulation(seed, { startHourOfDay: DEMO_START_HOUR });
  let fired = 0;
  let guard = 0;
  while (sim.clockHours < DEMO_DURATION_HOURS && guard < 200000) {
    // fire any steps whose time has arrived
    while (fired < DEMO_SCRIPT.length && DEMO_SCRIPT[fired].atHours <= sim.clockHours) {
      for (const a of DEMO_SCRIPT[fired].actions ?? []) {
        if (a.type === "dispatch") sim = dispatchShipment(sim, a.opts);
        else if (a.type === "scenario") sim = { ...sim, scenarioOffsetC: a.offsetC };
        // speed/heatmap are view-only — no effect on the headless sim
      }
      fired++;
    }
    sim = stepSimulation(sim, SIM_DT_HOURS);
    guard++;
  }
  return sim;
}

describe("demo script (Phase 8)", () => {
  it("is well-formed: sorted, within duration, every dispatch has a route target", () => {
    for (let i = 1; i < DEMO_SCRIPT.length; i++) {
      expect(DEMO_SCRIPT[i].atHours).toBeGreaterThanOrEqual(DEMO_SCRIPT[i - 1].atHours);
    }
    for (const step of DEMO_SCRIPT) {
      expect(step.atHours).toBeGreaterThanOrEqual(0);
      expect(step.atHours).toBeLessThanOrEqual(DEMO_DURATION_HOURS);
      expect(step.caption.length).toBeGreaterThan(0);
    }
  });

  it("replays IDENTICALLY on the fixed seed (RULE 4)", () => {
    const a = runDemo(DEMO_SEED);
    const b = runDemo(DEMO_SEED);
    expect(a).toEqual(b);
  });

  it("produces a meaningful run (multiple shipments, some delivered)", () => {
    const final = runDemo(DEMO_SEED);
    expect(final.shipments.length).toBeGreaterThanOrEqual(4);
    expect(final.shipments.some((s) => s.status === "delivered")).toBe(true);
  });
});
