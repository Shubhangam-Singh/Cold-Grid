import { beforeEach, describe, expect, it } from "vitest";
import { useColdgridStore } from "./coldgridStore";
import { getNode } from "@/lib/city/chennai";
import { createSimulation } from "@/lib/engine/simulation";

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
