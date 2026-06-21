"use client";

/**
 * Incomplete deliveries — loads diverted to a cold hub. Each parked load shows
 * its hub, the accruing storage fee, and a "Resume" button that re-dispatches it
 * from the hub to its original destination. Renders nothing when none are held.
 */

import { useColdgridStore } from "@/store/coldgridStore";
import { planRoute } from "@/lib/city/chennai";
import { getProduce } from "@/lib/engine/produce";
import { heldFeeRupees, heldHours } from "@/lib/logistics/hubHold";

const PRODUCE_EMOJI: Record<string, string> = {
  fish: "🐟", milk: "🥛", paneer: "🧀", tomato: "🍅",
  mango: "🥭", banana: "🍌", leafyVeg: "🥬", apple: "🍎",
};

export default function HeldShipmentsPanel() {
  const heldShipments = useColdgridStore((s) => s.heldShipments);
  const clockHours = useColdgridStore((s) => s.sim.clockHours);
  const closedEdgeIds = useColdgridStore((s) => s.sim.closedEdgeIds);
  const resumeFromHub = useColdgridStore((s) => s.resumeFromHub);

  const held = Object.values(heldShipments);
  if (held.length === 0) return null;

  return (
    <div className="w-72 rounded-xl glass-panel p-4 animate-slide-up">
      <div className="mb-3 flex items-baseline justify-between border-b border-white/5 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">
          ⏸ Incomplete deliveries
        </span>
        <span className="font-mono text-[10px] text-amber-400/80">{held.length} held</span>
      </div>

      <ul className="space-y-3">
        {held.map((h) => {
          const profile = getProduce(h.produce);
          const emoji = PRODUCE_EMOJI[h.produce] ?? "📦";
          const parked = h.arrivedClockHours != null;
          const fee = heldFeeRupees(h, clockHours);
          const hours = heldHours(h, clockHours);
          const canResume =
            parked && planRoute(h.hubId, h.originalDestId, { closedEdgeIds }) !== null;

          return (
            <li
              key={h.shipmentId}
              className="rounded-lg border border-amber-700/40 bg-amber-950/15 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  {emoji} {profile.label}{" "}
                  <span className="font-mono text-[10px] font-normal text-slate-400">
                    #{h.shipmentId.slice(0, 6)}
                  </span>
                </span>
                <span className="font-mono text-[11px] font-bold text-amber-300">{h.qualityAtHold.toFixed(0)}%</span>
              </div>

              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.05em] text-slate-400">
                {parked ? (
                  <>at <span className="text-twin-cyan">{h.hubName}</span></>
                ) : (
                  <span className="text-amber-400">diverting to {h.hubName}…</span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                → onward to {h.originalDestName}
              </div>

              {parked && (
                <>
                  <div className="mt-2 flex items-center justify-between rounded-md bg-slate-950/50 px-2 py-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      Hub fee · {hours.toFixed(1)}h
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      ₹{Math.round(fee).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <button
                    onClick={() => resumeFromHub(h.shipmentId)}
                    disabled={!canResume}
                    className="mt-2 w-full rounded-md border border-twin-emerald/50 bg-twin-emerald/15 px-3 py-1.5 text-xs font-bold text-twin-emerald transition-all duration-200 hover:bg-twin-emerald/30 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/50 disabled:text-slate-500 disabled:shadow-none"
                  >
                    {canResume ? `▶ Resume → ${h.originalDestName}` : "No open route"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
