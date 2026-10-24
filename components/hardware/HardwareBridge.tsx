"use client";

/**
 * Opens the PPSC websocket only while the operator toggle is on.
 * Mounted once at the root so /hardware, /ledger, and the fleet share one feed.
 */

import { useEffect } from "react";
import { parseFrame } from "@/lib/hardware/parseFrame";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";

export default function HardwareBridge() {
  const listen = useLiveHardwareStore((s) => s.listen);
  const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8765";

  useEffect(() => {
    if (!listen) {
      useLiveHardwareStore.getState().setConnected(false);
      return;
    }
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(url);
      ws.onopen = () => useLiveHardwareStore.getState().setConnected(true);
      ws.onclose = () => {
        useLiveHardwareStore.getState().setConnected(false);
        if (!stopped) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws?.close();
      ws.onmessage = (event) => {
        try {
          const reading = parseFrame(JSON.parse(String(event.data)));
          if (reading) useLiveHardwareStore.getState().ingest(reading);
        } catch {
          /* ignore malformed frames */
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      ws?.close();
      useLiveHardwareStore.getState().setConnected(false);
    };
  }, [listen, url]);

  return null;
}
