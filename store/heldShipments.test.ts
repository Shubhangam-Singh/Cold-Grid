import { describe, expect, it, beforeEach } from "vitest";
import { useColdgridStore } from "./coldgridStore";
import { createBatch } from "@/lib/engine/spoilage";
import type { Shipment } from "@/lib/engine/simulation";
import { HUB_FEE_PER_HOUR_RUPEES, type HeldShipment } from "@/lib/logistics/hubHold";

const HUB = "hub-guindy";
const DEST = "mylapore";

function deliveredAtHub(id: string): Shipment {
  return {
    id,
    label: "Fish → Guindy",
    produce: "fish",
    batch: createBatch(id, "fish"),
    route: ["kasimedu_perambur"],
    legIndex: 0,
    legProgress: 1,
    status: "delivered", // reached the hub
    originId: "kasimedu",
    destinationId: HUB,
    dispatchClockHours: 0,
    position: [80.212, 13.008],
    angle: 0,
    transportSetpointC: 4,
    energyKwh: 7,
    lastTempC: 5,
    lastRH: 80,
    lastVOC: 1,
    driverId: "kumar",
    crisisSpeedPenalty: 1,
    crisisCheckedLegs: [],
  };
}

function heldEntry(id: string): HeldShipment {
  return {
    shipmentId: id,
    produce: "fish",
    hubId: HUB,
    hubName: "Guindy Cold Hub",
    originalDestId: DEST,
    originalDestName: "Mylapore",
    qualityAtHold: 80,
    arrivedClockHours: null,
    snapshot: null,
  };
}

describe("cold-hub hold → resume lifecycle (store)", () => {
  beforeEach(() => {
    useColdgridStore.getState().resetSim();
  });

  it("parks a diverted truck at the hub, accrues fee, and resumes to the original destination", () => {
    const id = "SHP-HOLD";
    const store = useColdgridStore;

    // Truck has just reached the hub (delivered), with a pending held record.
    store.setState((s) => ({
      sim: { ...s.sim, shipments: [deliveredAtHub(id)], clockHours: 5, closedEdgeIds: [] },
      heldShipments: { [id]: heldEntry(id) },
      hubFeesPaidRupees: 0,
    }));

    // 1) Settle arrival → parked + pulled out of the active sim (INCOMPLETE).
    store.getState().settleHeldArrivals();
    let st = store.getState();
    expect(st.heldShipments[id].arrivedClockHours).toBe(5);
    expect(st.heldShipments[id].snapshot).not.toBeNull();
    expect(st.sim.shipments.find((s) => s.id === id)).toBeUndefined();

    // 2) Three sim-hours pass while parked.
    store.setState((s) => ({ sim: { ...s.sim, clockHours: 8 } }));

    // 3) Resume → re-dispatched in-transit to the ORIGINAL destination, fee banked.
    store.getState().resumeFromHub(id);
    st = store.getState();
    expect(st.heldShipments[id]).toBeUndefined();
    const resumed = st.sim.shipments.find((s) => s.id === id);
    expect(resumed).toBeDefined();
    expect(resumed!.status).toBe("in-transit");
    expect(resumed!.destinationId).toBe(DEST);
    expect(resumed!.originId).toBe(HUB);
    expect(resumed!.route.length).toBeGreaterThan(0);
    // Cargo carried over (not a fresh batch); 3h × ₹/h banked.
    expect(resumed!.energyKwh).toBe(7);
    expect(st.hubFeesPaidRupees).toBe(3 * HUB_FEE_PER_HOUR_RUPEES);
  });

  it("does not park a truck that is still en route to the hub", () => {
    const id = "SHP-ENROUTE";
    const store = useColdgridStore;
    const enroute = { ...deliveredAtHub(id), status: "in-transit" as const };
    store.setState((s) => ({
      sim: { ...s.sim, shipments: [enroute], clockHours: 5 },
      heldShipments: { [id]: heldEntry(id) },
    }));
    store.getState().settleHeldArrivals();
    const st = store.getState();
    expect(st.heldShipments[id].arrivedClockHours).toBeNull();
    expect(st.sim.shipments.find((s) => s.id === id)).toBeDefined(); // still moving
  });
});
