"use client";

/**
 * Live PPSC panel. Maps the cart's DHT22 + MQ-135 readings onto the Kasimedu
 * fish node, runs the same Arrhenius+EMA step as the fleet, and shows the
 * v25 5-tier sell price.
 */

import { useEffect, useRef, useState } from "react";
import { getNode, nodeHoldingTempC } from "@/lib/city/chennai";
import { createBatch, stepBatch } from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";
import type { Batch } from "@/lib/engine/types";
import { rgbCss, tempToRgb } from "@/components/twin/colors";
import { useHardwareBridge } from "@/lib/hardware/useHardwareBridge";
import CargoHealth from "@/components/twin/CargoHealth";

const NODE_ID = "kasimedu";
const PRODUCE = "fish" as const;

export default function LiveNodePanel() {
  const { enabled, connected, reading } = useHardwareBridge();
  const node = getNode(NODE_ID);
  const profile = getProduce(PRODUCE);

  const syntheticTemp = nodeHoldingTempC(node, 14, 0);
  const isLive = enabled && connected && reading != null;
  const actualTemp = isLive ? reading!.tempC : syntheticTemp;
  const actualRH = isLive ? reading!.humidity : profile.rhRef;
  const actualVOC = isLive ? reading!.gas : profile.vocRef;
  const tColor = rgbCss(tempToRgb(actualTemp));

  const [batch, setBatch] = useState<Batch>(() => createBatch("live-ppsc", PRODUCE));
  const lastAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLive || !reading) {
      setBatch(createBatch("live-ppsc", PRODUCE));
      lastAtRef.current = null;
      return;
    }
    const prev = lastAtRef.current;
    lastAtRef.current = reading.at;
    if (prev == null) return;
    const dtHours = Math.min(Math.max(0, (reading.at - prev) / 3600), 0.25);
    if (dtHours <= 0) return;
    setBatch((b) => stepBatch(b, profile, reading.tempC, reading.humidity, reading.gas, dtHours));
  }, [isLive, reading, profile]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan text-glow">
            PPSC bench · {node.name}
          </div>
          <div className="text-xs text-slate-500">{profile.label} · DHT22 + MQ-135</div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
            isLive ? "bg-twin-danger/15 text-twin-danger" : "bg-slate-700/50 text-slate-300"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-twin-danger animate-pulse" : "bg-slate-500"}`} />
          {isLive ? "Live cart" : enabled ? "Awaiting cart…" : "Synthetic"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Reading label="Temp" value={`${actualTemp.toFixed(1)}°C`} color={tColor} />
        <Reading label="Humidity" value={`${actualRH.toFixed(0)}%`} />
        <Reading label="Gas (VOC)" value={actualVOC.toFixed(0)} />
      </div>

      <div className="mt-4">
        <CargoHealth
          produce={PRODUCE}
          batch={batch}
          T_C={actualTemp}
          RH={actualRH}
          VOC={actualVOC}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Same Arrhenius + EMA step as the cart firmware (PPSC v25). Humidity and VOC
        multiply the rate after the exponent; only thermal memory changes Ea.
        {isLive
          ? " Warm the probe — rate rises, remaining life falls, sell price marks down."
          : " Enable the bridge (NEXT_PUBLIC_ENABLE_HARDWARE=true) to drive this from the real cart."}
      </p>
    </div>
  );
}

function Reading({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-900/50 p-2.5 text-center">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg font-bold" style={{ color: color ?? "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}
