import { beforeEach, describe, expect, it } from "vitest";
import { useLiveHardwareStore } from "./liveHardwareStore";

describe("live hardware store", () => {
  beforeEach(() => {
    useLiveHardwareStore.getState().clearSession();
    useLiveHardwareStore.setState({
      listen: false,
      attachToFleet: false,
      connected: false,
      produceOverride: "fish",
    });
  });

  it("defaults to synthetic: toggle off, fleet attach off", () => {
    const s = useLiveHardwareStore.getState();
    expect(s.listen).toBe(false);
    expect(s.attachToFleet).toBe(false);
    expect(s.produceOverride).toBe("fish");
    expect(s.session.reading).toBeNull();
    expect(s.session.cartBatch).toBeNull();
  });

  it("ingests a frame without turning the fleet simulation on", () => {
    useLiveHardwareStore.getState().ingest({ tempC: 23.6, humidity: 71, gas: 251, at: 50 });
    const s = useLiveHardwareStore.getState();
    expect(s.session.reading?.tempC).toBe(23.6);
    expect(s.session.cartBatch?.quality).toBe(100);
    expect(s.attachToFleet).toBe(false);
  });
});
