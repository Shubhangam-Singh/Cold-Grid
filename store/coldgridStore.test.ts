import { beforeEach, describe, expect, it } from "vitest";
import { useColdgridStore } from "./coldgridStore";
import { getNode } from "@/lib/city/chennai";

function reset() {
  useColdgridStore.setState({
    hourOfDay: 14.5,
    scenarioOffsetC: 0,
    hoveredNodeId: null,
    selectedNodeId: null,
  });
}

describe("coldgridStore", () => {
  beforeEach(reset);

  it("loads the full Chennai graph", () => {
    const s = useColdgridStore.getState();
    expect(s.nodes.length).toBe(11);
    expect(s.edges.length).toBeGreaterThan(0);
  });

  it("wraps hour-of-day into [0,24)", () => {
    const { setHourOfDay } = useColdgridStore.getState();
    setHourOfDay(26);
    expect(useColdgridStore.getState().hourOfDay).toBeCloseTo(2, 9);
    setHourOfDay(-3);
    expect(useColdgridStore.getState().hourOfDay).toBeCloseTo(21, 9);
  });

  it("refrigerated nodes hold their setpoint regardless of clock/scenario", () => {
    const { nodeTempC, setScenarioOffsetC } = useColdgridStore.getState();
    setScenarioOffsetC(6); // heatwave
    expect(nodeTempC(getNode("aavin-madhavaram"))).toBe(4);
  });

  it("unrefrigerated node temperature rises with the scenario override", () => {
    const koyambedu = getNode("koyambedu");
    const before = useColdgridStore.getState().nodeTempC(koyambedu);
    useColdgridStore.getState().setScenarioOffsetC(5);
    const after = useColdgridStore.getState().nodeTempC(koyambedu);
    expect(after).toBeCloseTo(before + 5, 9);
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
