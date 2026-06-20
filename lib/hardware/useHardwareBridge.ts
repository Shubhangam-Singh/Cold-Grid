"use client";

/**
 * Hardware-in-the-loop bridge client (Phase 10), flag-gated OFF by default.
 *
 * With NEXT_PUBLIC_ENABLE_HARDWARE !== "true" this never opens a socket — the
 * app is completely unaffected and uses synthetic data (RULE 3). When the flag
 * is on it connects to the Python bridge's WebSocket and surfaces live cart
 * readings, auto-reconnecting if the bridge restarts.
 */

import { useEffect, useRef, useState } from "react";
import type { SensorReading } from "./types";

export interface HardwareBridge {
  enabled: boolean;
  connected: boolean;
  reading: SensorReading | null;
}

export function useHardwareBridge(): HardwareBridge {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_HARDWARE === "true";
  const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";

  const [connected, setConnected] = useState(false);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stopRef.current = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopRef.current) return;
      ws = new WebSocket(url);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopRef.current) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data as string);
          const tempC = Number(d.tempC ?? d.T);
          const humidity = Number(d.humidity ?? d.H);
          const gas = Number(d.gas ?? d.G);
          if (Number.isFinite(tempC)) {
            setReading({
              tempC,
              humidity: Number.isFinite(humidity) ? humidity : 0,
              gas: Number.isFinite(gas) ? gas : 0,
              at: typeof d.at === "number" ? d.at : Date.now() / 1000,
            });
          }
        } catch {
          /* ignore malformed frames */
        }
      };
    };

    connect();
    return () => {
      stopRef.current = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [enabled, url]);

  return { enabled, connected, reading };
}
