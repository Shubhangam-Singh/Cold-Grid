"use client";

/**
 * Add-on cart session. Default is off, so the fleet keeps synthetic sensors.
 * `NEXT_PUBLIC_ENABLE_HARDWARE=true` starts the toggle on for existing setups.
 * The simulation clock reads this while it ticks. The engine does not.
 */

import { create } from "zustand";
import { emptyLiveSession, ingestReading, type LiveSession } from "@/lib/hardware/liveSession";
import type { SensorReading } from "@/lib/hardware/types";
import type { ProduceId } from "@/lib/engine/types";

export interface LiveHardwareState {
  listen: boolean;
  /**
   * Pin the probe to the newest in-transit Kasimedu fish truck.
   * Off still feeds the newest in-transit truck while readings are live.
   */
  attachToFleet: boolean;
  /**
   * USB frames have no produce field. This is the OLED selection those frames
   * step with. A frame that names a produce wins over this.
   */
  produceOverride: ProduceId;
  connected: boolean;
  session: LiveSession;
  setListen: (listen: boolean) => void;
  setAttachToFleet: (attach: boolean) => void;
  setProduceOverride: (produce: ProduceId) => void;
  setConnected: (connected: boolean) => void;
  ingest: (reading: SensorReading) => void;
  clearSession: () => void;
}

export const useLiveHardwareStore = create<LiveHardwareState>((set) => ({
  listen: process.env.NEXT_PUBLIC_ENABLE_HARDWARE === "true",
  attachToFleet: false,
  produceOverride: "fish",
  connected: false,
  session: emptyLiveSession(),

  setListen: (listen) => set({ listen }),
  setAttachToFleet: (attachToFleet) => set({ attachToFleet }),
  setProduceOverride: (produceOverride) => set({ produceOverride }),
  setConnected: (connected) => set({ connected }),
  ingest: (reading) =>
    set((s) => ({
      session: ingestReading(s.session, reading, { produceOverride: s.produceOverride }),
    })),
  clearSession: () => set({ session: emptyLiveSession() }),
}));
