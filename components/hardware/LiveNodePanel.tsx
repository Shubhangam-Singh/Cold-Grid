"use client";

/**
 * Live-node panel (Phase 10). Maps the PPSC cart's live readings onto one
 * designated twin node (Kasimedu) and shows the patented engine's PREDICTED
 * shelf life against the cart's ACTUAL sensor temperature in real time.
 *
 * Flag OFF → synthetic baseline (app unaffected, RULE 3). Flag ON + cart
 * connected → live data; warming the probe visibly drops the prediction.
 */

import { getNode, nodeHoldingTempC } from "@/lib/city/chennai";
import { createBatch, predictedShelfLifeHours } from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";
import { rgbCss, tempToRgb } from "@/components/twin/colors";
import { useHardwareBridge } from "@/lib/hardware/useHardwareBridge";

const NODE_ID = "kasimedu";
const PRODUCE = "fish" as const;

export default function LiveNodePanel() {
  const { enabled, connected, reading } = useHardwareBridge();
  const node = getNode(NODE_ID);
  const profile = getProduce(PRODUCE);

  const syntheticTemp = nodeHoldingTempC(node, 14, 0); // afternoon ambient baseline
  const isLive = enabled && connected && reading != null;
  const actualTemp = isLive ? reading!.tempC : syntheticTemp;

  const predicted = predictedShelfLifeHours(createBatch("live", PRODUCE), profile, actualTemp);
  const baseline = predictedShelfLifeHours(createBatch("base", PRODUCE), profile, syntheticTemp);
  const tColor = rgbCss(tempToRgb(actualTemp));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan text-glow">
            Live node · {node.name}
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

      {/* Sensor readings */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Reading label="Temp" value={`${actualTemp.toFixed(1)}°C`} color={tColor} />
        <Reading label="Humidity" value={isLive ? `${reading!.humidity.toFixed(0)}%` : "—"} />
        <Reading label="Gas (VOC)" value={isLive ? reading!.gas.toFixed(0) : "—"} />
      </div>

      {/* Predicted vs actual */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Model predicts (at sensor temp)
            </div>
            <div className="font-mono text-3xl font-bold" style={{ color: tColor }}>
              ~{predicted.toFixed(1)} h
            </div>
            <div className="text-[11px] text-slate-500">remaining shelf life</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">vs baseline</div>
            <div
              className={`font-mono text-lg font-semibold ${
                predicted < baseline ? "text-twin-danger" : "text-twin-emerald"
              }`}
            >
              {predicted < baseline ? "▼" : "▲"} {Math.abs(predicted - baseline).toFixed(1)} h
            </div>
            <div className="text-[11px] text-slate-500">baseline ~{baseline.toFixed(1)} h</div>
          </div>
        </div>
        <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-slate-400">
          The patented Adaptive Arrhenius + EMA engine turns the cart&apos;s live temperature into a shelf-life
          prediction. {isLive
            ? "Warm the probe and watch the prediction fall in real time."
            : "Run the bridge (bridge/) with NEXT_PUBLIC_ENABLE_HARDWARE=true to drive this from the real cart."}
        </p>
      </div>
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
