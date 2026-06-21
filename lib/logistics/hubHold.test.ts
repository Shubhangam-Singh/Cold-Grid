import { describe, expect, it } from "vitest";
import {
  HUB_FEE_PER_HOUR_RUPEES,
  type HeldShipment,
  heldFeeRupees,
  heldHours,
  hubFeeRupees,
  totalHubFeesRupees,
} from "./hubHold";

function held(over: Partial<HeldShipment> = {}): HeldShipment {
  return {
    shipmentId: "SHP-1",
    produce: "fish",
    hubId: "hub-guindy",
    hubName: "Guindy Cold Hub",
    originalDestId: "mylapore",
    originalDestName: "Mylapore",
    qualityAtHold: 80,
    arrivedClockHours: 10,
    snapshot: null,
    ...over,
  };
}

describe("hub hold fees", () => {
  it("charges nothing while still en route to the hub", () => {
    const h = held({ arrivedClockHours: null });
    expect(heldHours(h, 12)).toBe(0);
    expect(heldFeeRupees(h, 12)).toBe(0);
  });

  it("accrues ₹/hour from arrival", () => {
    const h = held({ arrivedClockHours: 10 });
    expect(heldHours(h, 13)).toBe(3);
    expect(heldFeeRupees(h, 13)).toBe(3 * HUB_FEE_PER_HOUR_RUPEES);
    expect(hubFeeRupees(2)).toBe(2 * HUB_FEE_PER_HOUR_RUPEES);
  });

  it("never goes negative if the clock is behind arrival", () => {
    const h = held({ arrivedClockHours: 10 });
    expect(heldFeeRupees(h, 9)).toBe(0);
  });

  it("totals banked + currently-accruing fees", () => {
    const parked = [held({ shipmentId: "a", arrivedClockHours: 10 }), held({ shipmentId: "b", arrivedClockHours: 11 })];
    // banked ₹500 + a: 2h + b: 1h = 3h × rate
    expect(totalHubFeesRupees(parked, 500, 12)).toBe(500 + 3 * HUB_FEE_PER_HOUR_RUPEES);
  });

  it("is pure — repeated calls give identical results", () => {
    const h = held();
    expect(heldFeeRupees(h, 15)).toBe(heldFeeRupees(h, 15));
  });
});
