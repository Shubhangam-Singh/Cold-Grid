"use client";

/**
 * Shared cart feed. The socket itself lives in HardwareBridge and opens only
 * while the operator toggle (or NEXT_PUBLIC_ENABLE_HARDWARE) is on.
 */

import type { SensorReading } from "./types";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";

export interface HardwareBridgeState {
  enabled: boolean;
  connected: boolean;
  reading: SensorReading | null;
}

export function useHardwareBridge(): HardwareBridgeState {
  const enabled = useLiveHardwareStore((s) => s.listen);
  const connected = useLiveHardwareStore((s) => s.connected);
  const reading = useLiveHardwareStore((s) => s.session.reading);
  return { enabled, connected, reading };
}
