import { beforeEach, describe, expect, it } from "vitest";
import { useColdgridStore } from "./coldgridStore";
import { getNode } from "@/lib/city/chennai";
import { createSimulation } from "@/lib/engine/simulation";
import { planHubHold } from "@/lib/copilot/actions";
import { worldFromSim } from "@/lib/copilot/world";

function reset() {
  useColdgridStore.setState({
    sim: createSimulation(12345),
    isPlaying: false,
    speed: 2,
    hoveredNodeId: null,
    selectedNodeId: null,
  });
}

describe("coldgridStore", () => {
  beforeEach(reset);

  it("loads the full Chennai graph and an empty simulation", () => {
    const s = useColdgridStore.getState();
    expect(s.nodes.length).toBeGreaterThanOrEqual(15); // 11 original + expansion nodes (Ennore, Tambaram, urban farms, community kitchens, …)
    expect(s.edges.length).toBeGreaterThan(0);
    expect(s.sim.shipments).toHaveLength(0);
  });

  it("dispatch adds a shipment; advance progresses and ages it", () => {
    const { dispatch, advance } = useColdgridStore.getState();
    dispatch({ produce: "fish", fromId: "kasimedu", toId: "mylapore" });
    expect(useColdgridStore.getState().sim.shipments).toHaveLength(1);

    advance(0.5);
    const ship = useColdgridStore.getState().sim.shipments[0];
    expect(ship.batch.ageHours).toBeCloseTo(0.5, 9);
    expect(useColdgridStore.getState().sim.tick).toBe(1);
  });

  it("advance applies a cart sample to that truck and leaves the call optional", () => {
    const { dispatch, advance } = useColdgridStore.getState();
    dispatch({ produce: "tomato", fromId: "koyambedu", toId: "t-nagar" });
    const id = useColdgridStore.getState().sim.shipments[0].id;
    advance(0.05, { [id]: { T_C: 24.6, RH: 75, VOC: 246 } });
    const ship = useColdgridStore.getState().sim.shipments[0];
    expect(ship.lastTempC).toBe(24.6);
    expect(ship.lastRH).toBe(75);
    expect(ship.lastVOC).toBe(246);
    expect(ship.produce).toBe("tomato");
  });

  it("a confirmed hub hold retargets the truck and keeps the original destination", () => {
    const { dispatch, applyHubHold, markSellNow } = useColdgridStore.getState();
    dispatch({ produce: "tomato", fromId: "koyambedu", toId: "t-nagar" });
    const before = useColdgridStore.getState().sim.shipments[0];
    const plan = planHubHold(worldFromSim(useColdgridStore.getState().sim), before.id);
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    const result = applyHubHold(before.id, plan.hubId);
    expect(result.ok).toBe(true);
    const after = useColdgridStore.getState();
    expect(after.sim.shipments[0].destinationId).toBe(plan.hubId);
    expect(after.heldShipments[before.id].originalDestId).toBe(before.destinationId);
    markSellNow(before.id, 20, "A");
    expect(useColdgridStore.getState().sellMarks[before.id].rupees).toBe(20);
    useColdgridStore.getState().pause();
  });

  it("wraps hour-of-day into [0,24)", () => {
    useColdgridStore.getState().setHourOfDay(26);
    expect(useColdgridStore.getState().sim.hourOfDay).toBeCloseTo(2, 9);
  });

  it("refrigerated nodes hold setpoint; scenario override warms unrefrigerated", () => {
    const { nodeTempC, setScenarioOffsetC } = useColdgridStore.getState();
    setScenarioOffsetC(6);
    expect(nodeTempC(getNode("aavin-madhavaram"))).toBe(4);

    const koyambedu = getNode("koyambedu");
    const before = nodeTempC(koyambedu);
    useColdgridStore.getState().setScenarioOffsetC(0);
    const after = useColdgridStore.getState().nodeTempC(koyambedu);
    expect(before).toBeCloseTo(after + 6, 9);
  });

  it("playback toggles and resets", () => {
    const { togglePlay, dispatch, resetSim } = useColdgridStore.getState();
    togglePlay();
    expect(useColdgridStore.getState().isPlaying).toBe(true);
    dispatch({ produce: "milk", fromId: "aavin-madhavaram", toId: "adyar" });
    resetSim();
    const s = useColdgridStore.getState();
    expect(s.sim.shipments).toHaveLength(0);
    expect(s.isPlaying).toBe(false);
  });

  it("tracks hover and selection", () => {
    const { setHoveredNode, setSelectedNode } = useColdgridStore.getState();
    setHoveredNode("t-nagar");
    setSelectedNode("kasimedu");
    const s = useColdgridStore.getState();
    expect(s.hoveredNodeId).toBe("t-nagar");
    expect(s.selectedNodeId).toBe("kasimedu");
  });
});
