"use client";

/**
 * Live shipment roster: each active/delivered shipment with a quality bar, its
 * route, and status. Reads straight from the store's simulation state.
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { getNode } from "@/lib/city/chennai";
import { getProduce } from "@/lib/engine/produce";
import { qualityToRgb, rgbCss } from "./colors";

export default function ShipmentPanel() {
  const shipments = useColdgridStore((s) => s.sim.shipments);

  const delivered = shipments.filter((s) => s.status === "delivered");
  const spoiled = shipments.filter((s) => s.batch.quality <= 0).length;

  return (
    <div className="pointer-events-auto absolute right-4 top-36 z-10 w-64 rounded-lg border border-slate-800 bg-slate-950/85 p-3 backdrop-blur">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Shipments
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          {shipments.length} total · {delivered.length} done · {spoiled} spoiled
        </span>
      </div>

      {shipments.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-500">
          Dispatch a shipment, then press play.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {[...shipments].reverse().map((s) => {
            const profile = getProduce(s.produce);
            const q = s.batch.quality;
            const color = rgbCss(qualityToRgb(q));
            return (
              <li key={s.id} className="rounded bg-slate-900/70 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200">
                    {profile.label}{" "}
                    <span className="font-mono text-[10px] text-slate-500">{s.id}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold" style={{ color }}>
                    {q.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full rounded"
                    style={{ width: `${q}%`, backgroundColor: color }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-slate-500">
                  <span>
                    {getNode(s.originId).name.split(" ")[0]} →{" "}
                    {getNode(s.destinationId).name.split(" ")[0]}
                  </span>
                  <span className={s.status === "delivered" ? "text-slate-400" : "text-sky-400"}>
                    {q <= 0 ? "spoiled" : s.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
