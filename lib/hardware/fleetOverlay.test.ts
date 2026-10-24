import { describe, expect, it } from "vitest";
import { createBatch } from "../engine/spoilage";
import { emptyLiveSession, ingestReading } from "./liveSession";
import {
  cartOverlayFor,
  cartTargetId,
  liveCargoSensors,
  newestInTransitId,
  newestKasimeduFishId,
  type FleetShipmentRef,
} from "./fleetOverlay";
import type { SensorReading } from "./types";

function ship(partial: Partial<FleetShipmentRef> & Pick<FleetShipmentRef, "id">): FleetShipmentRef {
  return {
    originId: "kasimedu",
    produce: "fish",
    status: "in-transit",
    ...partial,
  };
}

function liveSession(tempC: number) {
  const reading: SensorReading = { tempC, humidity: 70, gas: 200, at: 1_000 };
  let session = ingestReading(emptyLiveSession(), { ...reading, at: 990 });
  session = ingestReading(session, reading);
  return session;
}

const nowMs = 1_001_000;

describe("newestKasimeduFishId", () => {
  it("picks the latest in-transit fish truck that left Kasimedu", () => {
    const id = newestKasimeduFishId([
      ship({ id: "SHP-1" }),
      ship({ id: "SHP-2", produce: "milk" }),
      ship({ id: "SHP-3", originId: "koyambedu" }),
      ship({ id: "SHP-4", status: "delivered" }),
      ship({ id: "SHP-5" }),
    ]);
    expect(id).toBe("SHP-5");
  });

  it("returns null when no fish truck is in transit from Kasimedu", () => {
    expect(newestKasimeduFishId([ship({ id: "SHP-1", status: "delivered" })])).toBeNull();
  });
});

describe("cart target", () => {
  const fleet = [
    ship({ id: "SHP-1" }),
    ship({ id: "SHP-3", originId: "koyambedu", produce: "tomato" }),
    ship({ id: "SHP-4", status: "delivered" }),
  ];

  it("follows the newest in-transit truck when the fish pin is off", () => {
    expect(newestInTransitId(fleet)).toBe("SHP-3");
    expect(cartTargetId(fleet, false)).toBe("SHP-3");
  });

  it("pins the Kasimedu fish truck when that toggle is on", () => {
    expect(cartTargetId(fleet, true)).toBe("SHP-1");
  });

  it("falls back to the newest truck when the pin is on and no fish truck is out", () => {
    const tomatoOnly = [ship({ id: "SHP-3", originId: "koyambedu", produce: "tomato" })];
    expect(cartTargetId(tomatoOnly, true)).toBe("SHP-3");
  });
});

describe("cartOverlayFor", () => {
  const session = liveSession(23.6);
  const tomato = createBatch("SHP-3", "tomato");
  const base = {
    listen: true,
    connected: true,
    session,
    nowMs,
    candidateId: "SHP-3",
    truckBatch: tomato,
  };
  const tomatoTruck = ship({ id: "SHP-3", originId: "koyambedu", produce: "tomato" });

  it("paints the open truck with the probe and keeps that truck's batch", () => {
    const overlay = cartOverlayFor(tomatoTruck, base);
    expect(overlay?.tempC).toBe(23.6);
    expect(overlay?.rh).toBe(70);
    expect(overlay?.voc).toBe(200);
    expect(overlay?.quality).toBe(tomato.quality);
    expect(overlay?.batch.produce).toBe("tomato");
    expect(cartOverlayFor(ship({ id: "SHP-1" }), { ...base, truckBatch: createBatch("SHP-1", "fish") })).toBeNull();
  });

  it("drops when readings are off or the frame is stale", () => {
    expect(cartOverlayFor(tomatoTruck, { ...base, listen: false })).toBeNull();
    expect(cartOverlayFor(tomatoTruck, { ...base, nowMs: 1_020_000 })).toBeNull();
  });

  it("still uses the probe temperature when the bench produce is not the truck's", () => {
    const milk = ingestReading(emptyLiveSession(), {
      tempC: 10,
      humidity: 50,
      gas: 10,
      at: 1_000,
      produce: "Milk",
    });
    const overlay = cartOverlayFor(tomatoTruck, { ...base, session: milk });
    expect(overlay?.tempC).toBe(10);
    expect(overlay?.batch.produce).toBe("tomato");
  });
});

describe("liveCargoSensors", () => {
  const session = liveSession(24.6);
  const shipments = [
    ship({ id: "SHP-1" }),
    ship({ id: "SHP-3", originId: "koyambedu", produce: "tomato" }),
  ];
  const args = {
    listen: true,
    connected: true,
    session,
    nowMs,
    shipments,
    attachFish: false,
  };

  it("feeds only the target truck, and only while the frame is live", () => {
    expect(liveCargoSensors(args)).toEqual({
      "SHP-3": { T_C: 24.6, RH: 70, VOC: 200 },
    });
    expect(liveCargoSensors({ ...args, attachFish: true })).toEqual({
      "SHP-1": { T_C: 24.6, RH: 70, VOC: 200 },
    });
    expect(liveCargoSensors({ ...args, listen: false })).toBeUndefined();
    expect(liveCargoSensors({ ...args, nowMs: 1_020_000 })).toBeUndefined();
  });
});
