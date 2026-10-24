"use client";

/**
 * Live PPSC bench. With the cart toggle off, this is the synthetic Kasimedu
 * fish baseline. With it on, DHT22 + MQ-135 frames from the bridge drive a
 * side batch on the firmware's 2-second clock. A dropped frame freezes that
 * batch instead of resetting freshness to 100%.
 */

import { useEffect, useState } from "react";
import { getNode, nodeHoldingTempC } from "@/lib/city/chennai";
import { createBatch } from "@/lib/engine/spoilage";
import { getProduce, PRODUCE_IDS } from "@/lib/engine/produce";
import type { ProduceId } from "@/lib/engine/types";
import { recommendSellPrice } from "@/lib/engine/pricing";
import { rgbCss, tempToRgb } from "@/components/twin/colors";
import CargoHealth from "@/components/twin/CargoHealth";
import { cartTargetId, newestKasimeduFishId } from "@/lib/hardware/fleetOverlay";
import { ppscUnitId } from "@/lib/hardware/ppsc";
import { benchMode, LIVE_BATCH_ID } from "@/lib/hardware/liveSession";
import { useColdgridStore } from "@/store/coldgridStore";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";
import CartToggle from "./CartToggle";
import LiveChainStatus from "@/components/chain/LiveChainStatus";

const NODE_ID = "kasimedu";
const PRODUCE = "fish" as const;

export default function LiveNodePanel() {
  const listen = useLiveHardwareStore((s) => s.listen);
  const connected = useLiveHardwareStore((s) => s.connected);
  const session = useLiveHardwareStore((s) => s.session);
  const attach = useLiveHardwareStore((s) => s.attachToFleet);
  const setAttach = useLiveHardwareStore((s) => s.setAttachToFleet);
  const produceOverride = useLiveHardwareStore((s) => s.produceOverride);
  const setProduceOverride = useLiveHardwareStore((s) => s.setProduceOverride);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const dispatch = useColdgridStore((s) => s.dispatch);
  const fishId = newestKasimeduFishId(shipments);
  const targetId = cartTargetId(shipments, attach);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!listen) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [listen]);

  const node = getNode(NODE_ID);
  const profile = getProduce(PRODUCE);
  const mode = benchMode({ listen, connected, reading: session.reading, nowMs });
  const reading = session.reading;
  const frozen = mode === "live" || mode === "lost";
  const syntheticTemp = nodeHoldingTempC(node, 14, 0);

  const tempC = frozen && reading ? reading.tempC : syntheticTemp;
  const humidity = frozen && reading ? reading.humidity : profile.rhRef;
  const gas = frozen && reading ? reading.gas : profile.vocRef;
  const batch =
    frozen && session.cartBatch ? session.cartBatch : createBatch(LIVE_BATCH_ID, PRODUCE);
  const tColor = rgbCss(tempToRgb(tempC));
  const benchQuote = recommendSellPrice({
    produce: frozen ? session.cartProduce : PRODUCE,
    qualityPct: batch.quality,
  });
  const ageS = reading && frozen ? Math.max(0, nowMs / 1000 - reading.at) : null;

  const badge =
    mode === "live"
      ? "Live cart"
      : mode === "lost"
        ? "Signal lost"
        : mode === "awaiting"
          ? "Awaiting cart…"
          : "Synthetic";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <CartToggle />

      <label className="mt-3 block">
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
          Cart produce — USB lines omit this, match the OLED
        </span>
        <select
          value={produceOverride}
          onChange={(event) => setProduceOverride(event.target.value as ProduceId)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200"
        >
          {PRODUCE_IDS.map((id) => (
            <option key={id} value={id}>
              {getProduce(id).label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          aria-pressed={attach}
          onClick={() => setAttach(!attach)}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan ${
            attach
              ? "border-twin-cyan/40 bg-twin-cyan/10 text-twin-cyan"
              : "border-slate-800 text-slate-300"
          }`}
        >
          Drive Kasimedu fish truck {attach ? "· on" : "· off"}
        </button>
        {attach && fishId == null && (
          <button
            type="button"
            onClick={() => dispatch({ produce: "fish", fromId: "kasimedu", toId: "mylapore" })}
            className="rounded-xl border border-slate-700 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-slate-500"
          >
            Dispatch fish · Kasimedu → Mylapore
          </button>
        )}
        {mode === "live" && targetId && (
          <p className="text-[11px] leading-relaxed text-slate-500">
            {attach && fishId
              ? `${ppscUnitId(fishId)} is pinned to this probe. Other trucks stay on city ambient.`
              : `${ppscUnitId(targetId)} uses this probe instead of city ambient. The truck keeps its own cargo. Other trucks stay synthetic.`}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan text-glow">
            PPSC bench · {node.name}
          </div>
          <div className="text-xs text-slate-500">
            {(frozen ? getProduce(session.cartProduce).label : profile.label)} · DHT22 + MQ-135
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
            mode === "live"
              ? "bg-twin-danger/15 text-twin-danger"
              : mode === "lost"
                ? "bg-twin-amber/15 text-twin-amber"
                : "bg-slate-700/50 text-slate-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              mode === "live" ? "bg-twin-danger animate-pulse" : mode === "lost" ? "bg-twin-amber" : "bg-slate-500"
            }`}
          />
          {badge}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Reading label="Temp" value={`${tempC.toFixed(1)}°C`} color={tColor} />
        <Reading label="Humidity" value={`${humidity.toFixed(0)}%`} />
        <Reading label="Gas (VOC)" value={gas.toFixed(0)} />
      </div>

      {frozen && reading && (reading.freshness != null || reading.price != null || reading.rate != null || reading.thermalEMA != null) && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {reading.freshness != null && <Reading label="Fresh" value={`${reading.freshness.toFixed(0)}%`} />}
          {reading.price != null && <Reading label="Cart ₹" value={reading.price.toFixed(0)} />}
          {reading.rate != null && <Reading label="Cart ×" value={reading.rate.toFixed(2)} />}
          {reading.thermalEMA != null && <Reading label="EMA" value={reading.thermalEMA.toFixed(3)} />}
        </div>
      )}

      <div className="mt-4">
        <CargoHealth produce={frozen ? session.cartProduce : PRODUCE} batch={batch} T_C={tempC} RH={humidity} VOC={gas} />
      </div>

      {frozen && reading?.price != null && (
        <p className="mt-2 font-mono text-[11px] text-slate-300">
          Cart sell price ₹{reading.price.toFixed(1)} · bench ₹{benchQuote.recommendedRs}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {mode === "synthetic" &&
          "Synthetic afternoon baseline. Turn on real readings, with the bridge running, to drive this from the cart."}
        {mode === "awaiting" &&
          "Toggle is on. Start the bridge on the cart's COM port. This bench stays on the synthetic baseline until the first frame."}
        {mode === "live" &&
          `Same Arrhenius + EMA step as the cart, on the 2-second firmware clock. Last sample ${ageS!.toFixed(0)}s ago.`}
        {mode === "lost" &&
          `No frame for ${ageS!.toFixed(0)}s. Freshness is frozen at the last good sample.`}
        {reading?.spike ? " Cart reported a temperature spike." : ""}
        {reading?.expired ? " Cart reports this load expired." : ""}
      </p>
      <LiveChainStatus />
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
