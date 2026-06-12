import { describe, expect, it } from "vitest";
import {
  type SimulationState,
  advanceShipment,
  clearDelivered,
  createSimulation,
  dispatchShipment,
  shipmentSpoiled,
  stepSimulation,
  syntheticSensors,
} from "./simulation";
import { createBatch } from "./spoilage";
import { getProduce } from "./produce";
import { edgePath, getEdge, planRoute, pointAlongPath } from "../city/chennai";

/** Run a simulation to completion (all shipments delivered) or a tick cap. */
function runToCompletion(
  state: SimulationState,
  dtHours: number,
  maxTicks = 100000
): { state: SimulationState; ticks: number } {
  let s = state;
  let ticks = 0;
  while (
    s.shipments.some((sh) => sh.status === "in-transit") &&
    ticks < maxTicks
  ) {
    s = stepSimulation(s, dtHours);
    ticks++;
  }
  return { state: s, ticks };
}

describe("route planning", () => {
  it("plans a connected Kasimedu → Mylapore route", () => {
    const route = planRoute("kasimedu", "mylapore");
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(0);
  });

  it("returns [] for same-node and null for impossible routes", () => {
    expect(planRoute("kasimedu", "kasimedu")).toEqual([]);
    // retail nodes have no outgoing edges → cannot originate a route to a source
    expect(planRoute("t-nagar", "koyambedu")).toBeNull();
  });

  it("respects closed edges and still finds an alternate to Velachery", () => {
    const main = planRoute("hub-guindy", "velachery");
    expect(main).toEqual(["guindy_velachery_main"]);
    const rerouted = planRoute("hub-guindy", "velachery", {
      closedEdgeIds: ["guindy_velachery_main"],
    });
    expect(rerouted).toEqual(["guindy_velachery_taramani"]);
  });
});

describe("headless full run (spec Phase 4)", () => {
  it("a fish shipment Kasimedu → Mylapore completes and degrades", () => {
    let s = createSimulation(42);
    s = dispatchShipment(s, {
      produce: "fish",
      fromId: "kasimedu",
      toId: "mylapore",
    });
    expect(s.shipments).toHaveLength(1);

    const { state, ticks } = runToCompletion(s, 0.1);
    expect(ticks).toBeLessThan(100000); // terminates, no hang
    const ship = state.shipments[0];
    expect(ship.status).toBe("delivered");
    expect(ship.batch.quality).toBeLessThan(100); // it spoiled some en route
    expect(ship.batch.history.length).toBeGreaterThan(0);
  });

  it("the delivered shipment ends at its destination coordinates", () => {
    let s = createSimulation(7);
    s = dispatchShipment(s, {
      produce: "milk",
      fromId: "aavin-madhavaram",
      toId: "adyar",
    });
    const { state } = runToCompletion(s, 0.1);
    const ship = state.shipments[0];
    // Velachery/Adyar destination — final position is the last node of the route.
    expect(ship.position[0]).toBeCloseTo(80.257, 1);
    expect(ship.position[1]).toBeCloseTo(13.006, 1);
  });
});

describe("physical realism", () => {
  it("a heatwave override spoils the same fish run worse than a normal day", () => {
    const dispatch = (offset: number) => {
      let s = createSimulation(99);
      s = { ...s, scenarioOffsetC: offset };
      s = dispatchShipment(s, {
        produce: "fish",
        fromId: "kasimedu",
        toId: "mylapore",
      });
      return runToCompletion(s, 0.1).state.shipments[0];
    };
    const normal = dispatch(0);
    const heatwave = dispatch(6);
    expect(heatwave.batch.cumulativeDeg).toBeGreaterThan(normal.batch.cumulativeDeg);
  });

  it("a refrigerated truck preserves quality far better than an ambient one", () => {
    const dispatchRun = (setpoint: number | null) => {
      let s = createSimulation(123);
      s = { ...s, scenarioOffsetC: 6 }; // heatwave
      s = dispatchShipment(s, {
        produce: "fish",
        fromId: "kasimedu",
        toId: "mylapore",
        transportSetpointC: setpoint,
      });
      return runToCompletion(s, 0.1).state.shipments[0];
    };
    const ambient = dispatchRun(null);
    const reefer = dispatchRun(2);
    expect(reefer.batch.quality).toBeGreaterThan(ambient.batch.quality);
    expect(reefer.batch.breachTicks).toBe(0); // 2°C never breaches fish's 25°C threshold
  });

  it("fragile milk on a long hot route is delivered spoiled", () => {
    let s = createSimulation(5);
    s = { ...s, scenarioOffsetC: 20 }; // heatwave
    s = dispatchShipment(s, {
      produce: "milk", // 5.5 h shelf life — unforgiving
      fromId: "aavin-madhavaram",
      toId: "velachery", // long southern run via two hubs
    });
    const { state } = runToCompletion(s, 0.1);
    const ship = state.shipments[0];
    expect(ship.status).toBe("delivered");
    expect(shipmentSpoiled(ship)).toBe(true);
    expect(ship.batch.quality).toBe(0);
  });
});

describe("road geometry & housekeeping", () => {
  it("shipments follow the real road polyline (not a straight line)", () => {
    // The Kasimedu→Perambur road bends; a midpoint on the real path differs
    // from the straight-line midpoint between the two nodes.
    const edge = getEdge("kasimedu_perambur");
    const path = edgePath(edge);
    expect(path.length).toBeGreaterThan(2); // baked geometry, not a 2-point line
    const start = path[0];
    const end = path[path.length - 1];
    const straightMid: [number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
    ];
    const roadMid = pointAlongPath(path, 0.5);
    const dev =
      Math.abs(roadMid[0] - straightMid[0]) + Math.abs(roadMid[1] - straightMid[1]);
    expect(dev).toBeGreaterThan(1e-4); // the road deviates from the chord
  });

  it("pointAlongPath returns the endpoints at t=0 and t=1", () => {
    const path = edgePath(getEdge("guindy_velachery_main"));
    expect(pointAlongPath(path, 0)).toEqual(path[0]);
    expect(pointAlongPath(path, 1)).toEqual(path[path.length - 1]);
  });

  it("a same-node or unroutable dispatch creates no shipment (would never animate)", () => {
    let s = createSimulation(1);
    s = dispatchShipment(s, { produce: "fish", fromId: "hub-ambattur", toId: "hub-ambattur" });
    expect(s.shipments).toHaveLength(0); // same node → no route → no-op
    s = dispatchShipment(s, { produce: "tomato", fromId: "t-nagar", toId: "koyambedu" });
    expect(s.shipments).toHaveLength(0); // retail can't originate → no-op
    // a real route still works and is in-transit
    s = dispatchShipment(s, { produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    expect(s.shipments).toHaveLength(1);
    expect(s.shipments[0].status).toBe("in-transit");
  });

  it("clearDelivered drops delivered shipments but keeps in-transit ones", () => {
    let s = createSimulation(1);
    s = dispatchShipment(s, { produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    s = stepSimulation(s, 0.1); // still in transit
    const cleared = clearDelivered(s);
    expect(cleared.shipments).toHaveLength(1);

    const delivered = runToCompletion(s, 0.1).state;
    expect(clearDelivered(delivered).shipments).toHaveLength(0);
  });
});

describe("determinism (RULE 4)", () => {
  it("identical seeds produce identical runs", () => {
    const build = () => {
      let s = createSimulation(2024);
      s = dispatchShipment(s, {
        produce: "fish",
        fromId: "kasimedu",
        toId: "mylapore",
      });
      return runToCompletion(s, 0.1).state;
    };
    expect(build()).toEqual(build());
  });

  it("syntheticSensors is a pure function of (seed, key, tick)", () => {
    const profile = getProduce("fish");
    const batch = createBatch("x", "fish");
    const a = syntheticSensors({ seed: 1, key: "k", tick: 3, baseTempC: 30, profile, batch });
    const b = syntheticSensors({ seed: 1, key: "k", tick: 3, baseTempC: 30, profile, batch });
    const c = syntheticSensors({ seed: 1, key: "k", tick: 4, baseTempC: 30, profile, batch });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

describe("purity (no input mutation)", () => {
  it("stepSimulation does not mutate its input state", () => {
    let s = createSimulation(1);
    s = dispatchShipment(s, {
      produce: "fish",
      fromId: "kasimedu",
      toId: "mylapore",
    });
    const snapshot = structuredClone(s);
    const next = stepSimulation(s, 0.1);
    expect(s).toEqual(snapshot); // input untouched
    expect(next).not.toBe(s);
    expect(next.shipments).not.toBe(s.shipments);
    expect(next.tick).toBe(s.tick + 1);
  });

  it("advanceShipment returns a new shipment and leaves a delivered one fixed", () => {
    let s = createSimulation(1);
    s = dispatchShipment(s, { produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    const ship = s.shipments[0];
    const ctx = { seed: 1, tick: 0, hourOfDay: 6, scenarioOffsetC: 0, dtHours: 0.1, closedEdgeIds: [] as string[] };
    const advanced = advanceShipment(ship, ctx);
    expect(advanced).not.toBe(ship);
    expect(ship.batch.ageHours).toBe(0); // original untouched

    const delivered = { ...ship, status: "delivered" as const };
    expect(advanceShipment(delivered, ctx)).toBe(delivered); // no-op, same ref
  });
});
