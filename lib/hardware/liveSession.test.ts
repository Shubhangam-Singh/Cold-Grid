import { describe, expect, it } from "vitest";
import { getProduce } from "../engine/produce";
import { FIRMWARE_LAMBDA, withFirmwareClock } from "./firmwareClock";
import {
  benchMode,
  emptyLiveSession,
  HISTORY_CAP,
  ingestReading,
  isReadingStale,
  LIVE_SHIPMENT_ID,
  produceFromDeviceName,
  STALE_AFTER_S,
  verifyOpenChain,
} from "./liveSession";
import { GENESIS_PREV } from "../chain/ledger";
import { parseFrame } from "./parseFrame";
import type { SensorReading } from "./types";

function frame(partial: Partial<SensorReading> & Pick<SensorReading, "at">): SensorReading {
  return {
    tempC: 23.6,
    humidity: 71,
    gas: 251,
    ...partial,
  };
}

describe("parseFrame", () => {
  it("accepts the serial bridge shape", () => {
    expect(parseFrame({ tempC: 23.6, humidity: 71, gas: 251, at: 10 })).toMatchObject({
      tempC: 23.6,
      humidity: 71,
      gas: 251,
      at: 10,
    });
  });

  it("accepts the cart /api/data names", () => {
    const reading = parseFrame({
      produce: "Fish",
      temp: 23.6,
      humidity: 71,
      vocPPM: 251,
      freshness: 98.5,
      price: 150,
      rate: 0.843,
      thermalEMA: 0.01,
      hoursRemaining: 16.2,
      spike: false,
      expired: false,
      at: 20,
    });
    expect(reading?.produce).toBe("Fish");
    expect(reading?.gas).toBe(251);
    expect(reading?.freshness).toBe(98.5);
    expect(reading?.spike).toBe(false);
  });

  it("rejects boot text and empty payloads", () => {
    expect(parseFrame(null)).toBeNull();
    expect(parseFrame("PPSC v26")).toBeNull();
    expect(parseFrame({ humidity: 70 })).toBeNull();
  });
});

describe("firmware clock", () => {
  it("overrides lambda on a copy and leaves the simulation profile alone", () => {
    const fish = getProduce("fish");
    const live = withFirmwareClock(fish);
    expect(fish.lambda).toBe(0.87);
    expect(live.lambda).toBe(FIRMWARE_LAMBDA.fish);
    expect(live.lambda).toBeCloseTo(0.996014, 6);
    expect(live.gamma).toBe(fish.gamma);
    expect(getProduce("fish").lambda).toBe(0.87);
  });
});

describe("produce names from the cart", () => {
  it("maps firmware labels and defaults to fish", () => {
    expect(produceFromDeviceName("Fish")).toBe("fish");
    expect(produceFromDeviceName("Leafy_Veg")).toBe("leafyVeg");
    expect(produceFromDeviceName("Leafy Veg")).toBe("leafyVeg");
    expect(produceFromDeviceName(undefined)).toBe("fish");
    expect(produceFromDeviceName("nope")).toBe("fish");
  });
});

describe("bench mode", () => {
  const reading = frame({ at: 100 });

  it("stays synthetic while the toggle is off", () => {
    expect(benchMode({ listen: false, connected: true, reading, nowMs: 100_000 })).toBe("synthetic");
  });

  it("waits, goes live, then freezes as lost after 6 seconds", () => {
    expect(benchMode({ listen: true, connected: false, reading: null, nowMs: 0 })).toBe("awaiting");
    expect(benchMode({ listen: true, connected: true, reading, nowMs: 101_000 })).toBe("live");
    expect(isReadingStale(reading, (100 + STALE_AFTER_S) * 1000 + 1)).toBe(true);
    expect(
      benchMode({ listen: true, connected: true, reading, nowMs: (100 + STALE_AFTER_S) * 1000 + 1000 })
    ).toBe("lost");
    expect(benchMode({ listen: true, connected: false, reading, nowMs: 101_000 })).toBe("lost");
  });
});

describe("ingestReading", () => {
  it("does not step on the first frame and does not reset when the same frame repeats", () => {
    const first = ingestReading(emptyLiveSession(), frame({ at: 1_000 }));
    expect(first.cartBatch?.quality).toBe(100);
    expect(first.cartBatch?.ema).toBe(0);
    const again = ingestReading(first, frame({ at: 1_000, tempC: 40 }));
    expect(again).toBe(first);
  });

  it("steps with the firmware clock and keeps quality when a later frame is only a repeat of state", () => {
    let session = ingestReading(emptyLiveSession(), frame({ at: 1_000, tempC: 35 }));
    session = ingestReading(session, frame({ at: 1_002, tempC: 35 }));
    expect(session.cartBatch!.ema).toBeGreaterThan(0);
    expect(session.cartBatch!.quality).toBeLessThan(100);
    const quality = session.cartBatch!.quality;
    const frozen = ingestReading(session, frame({ at: 1_002, tempC: 50 }));
    expect(frozen.cartBatch!.quality).toBe(quality);
  });

  it("prefers the cart's own freshness when the frame includes it", () => {
    let session = ingestReading(emptyLiveSession(), frame({ at: 1_000 }));
    session = ingestReading(session, frame({ at: 1_002, freshness: 42 }));
    expect(session.cartBatch!.quality).toBe(42);
  });

  it("caps history", () => {
    let session = emptyLiveSession();
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      session = ingestReading(session, frame({ at: i }));
    }
    expect(session.history).toHaveLength(HISTORY_CAP);
    expect(session.history[0].at).toBe(5);
  });

  it("seals a hash-linked block per new sample and ignores a replayed timestamp", () => {
    let session = ingestReading(emptyLiveSession(), frame({ at: 1_000, tempC: 23.6 }));
    expect(session.chain).toHaveLength(1);
    expect(session.chain[0].prevHash).toBe(GENESIS_PREV);
    expect(session.chain[0].attestation.shipmentId).toBe(LIVE_SHIPMENT_ID);
    expect(session.chain[0].attestation.reportedTempC).toBe(23.6);
    expect(session.chain[0].attestation.trueTempC).toBe(23.6);
    expect(session.chain[0].attestation.postedBy).toBe("transporter");
    expect(verifyOpenChain(session.chain).intact).toBe(true);

    session = ingestReading(session, frame({ at: 1_002, tempC: 30 }));
    expect(session.chain).toHaveLength(2);
    expect(session.chain[1].prevHash).toBe(session.chain[0].hash);
    expect(session.chain[1].attestation.seq).toBe(1);
    expect(session.chain[1].attestation.reportedTempC).toBeGreaterThan(
      session.chain[1].attestation.thresholdC
    );
    expect(verifyOpenChain(session.chain).intact).toBe(true);

    const sealed = ingestReading(session, frame({ at: 1_002, tempC: 40 }));
    expect(sealed.chain).toHaveLength(2);
    expect(sealed.seq).toBe(2);
  });

  it("keeps the remaining blocks linked after the window drops the oldest", () => {
    let session = emptyLiveSession();
    for (let i = 0; i < 5; i++) {
      session = ingestReading(session, frame({ at: 1_000 + i, tempC: 20 + i }), { chainCap: 3 });
    }
    expect(session.chain).toHaveLength(3);
    expect(session.chain[0].prevHash).not.toBe(GENESIS_PREV);
    expect(session.chain[1].prevHash).toBe(session.chain[0].hash);
    expect(session.seq).toBe(5);
    expect(verifyOpenChain(session.chain).intact).toBe(true);
  });

  it("flags a block whose sealed temperature was edited", () => {
    const session = ingestReading(emptyLiveSession(), frame({ at: 1_000, tempC: 23.6 }));
    const forged = [
      {
        ...session.chain[0],
        attestation: { ...session.chain[0].attestation, reportedTempC: 4 },
      },
    ];
    const result = verifyOpenChain(forged);
    expect(result.intact).toBe(false);
    expect(result.brokenAtIndex).toBe(0);
  });

  it("uses the USB produce override only when the frame names none", () => {
    const milk = ingestReading(emptyLiveSession(), frame({ at: 1_000 }), { produceOverride: "milk" });
    expect(milk.cartProduce).toBe("milk");
    const named = ingestReading(emptyLiveSession(), frame({ at: 1_000, produce: "Fish" }), {
      produceOverride: "milk",
    });
    expect(named.cartProduce).toBe("fish");
  });

  it("resets the side batch when the cart changes produce", () => {
    let session = ingestReading(emptyLiveSession(), frame({ at: 1_000, tempC: 40 }));
    session = ingestReading(session, frame({ at: 1_010, tempC: 40 }));
    expect(session.cartBatch!.quality).toBeLessThan(100);
    session = ingestReading(session, frame({ at: 1_012, produce: "Milk" }));
    expect(session.cartProduce).toBe("milk");
    expect(session.cartBatch!.quality).toBe(100);
  });
});
