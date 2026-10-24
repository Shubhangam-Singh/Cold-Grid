"use client";

/**
 * On-chain breach count for the live cart. Renders nothing unless
 * NEXT_PUBLIC_ENABLE_CHAIN is on, so free mode is unchanged.
 */

import { useEffect, useState } from "react";
import type { LiveChainStatus } from "@/lib/chain/liveStatus";

export default function LiveChainStatus() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_CHAIN === "true";
  const [status, setStatus] = useState<LiveChainStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/chain/live");
        const body = (await res.json()) as LiveChainStatus;
        if (!stopped) setStatus(body);
      } catch {
        if (!stopped) setStatus({ enabled: true, reachable: false, error: "status request failed" });
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 10_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [enabled]);

  if (!enabled || !status?.enabled) return null;

  const hash = status.lastTxHash ? `${status.lastTxHash.slice(0, 10)}…` : "no tx yet";

  return (
    <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-400">
      {status.reachable ? (
        <>
          Local chain · {status.shipmentId} · breaches {status.breachCount ?? 0}
          {status.lastTempC != null ? ` · last ${status.lastTempC.toFixed(1)}°C` : ""} · {hash}
        </>
      ) : (
        <>Local chain unreachable{status.error ? ` · ${status.error}` : ""}</>
      )}
    </p>
  );
}
