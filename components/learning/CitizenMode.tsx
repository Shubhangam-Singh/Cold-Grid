"use client";

/**
 * Citizen Mode — the simulation for everyone, not just operators. No technical
 * controls; one slider (cost vs food safety) drives the real engine and the
 * consequence is shown in plain English. Closes with the line that makes the
 * whole project click for a citizen.
 */

import { useState } from "react";
import { citizenOutcome } from "@/lib/learning/citizen";
import { qualityToRgb, rgbCss } from "@/components/twin/colors";

export default function CitizenMode() {
  const [care, setCare] = useState(50);
  const o = citizenOutcome(care);
  const qColor = o.spoiled ? "#ef4444" : rgbCss(qualityToRgb(o.qualityPct));

  const freshness = o.spoiled
    ? "arrive spoiled — a total loss"
    : o.qualityPct >= 80
    ? "arrive crisp and fresh"
    : o.qualityPct >= 50
    ? "arrive a little tired, but still sellable"
    : "arrive wilted and past their best";

  const coolingLine = o.reefer
    ? `Refrigeration added about ₹${o.coolingCostRupees.toFixed(0)} of energy and ${o.coolingCo2Kg.toFixed(1)} kg CO₂ to the trip.`
    : `You spent nothing on refrigeration — and it shows.`;

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 sm:p-7">
        <p className="text-center text-sm text-slate-300">
          A truck of vegetables is hauling from the Koyambedu wholesale market to a town market hours
          away, on a scorching Chennai afternoon. You make one call:
        </p>

        <label htmlFor="care" className="mt-6 block text-center text-base font-semibold text-white">
          How much do you care about cost vs. food safety?
        </label>
        <input
          id="care"
          type="range"
          min={0}
          max={100}
          value={care}
          onChange={(e) => setCare(Number(e.target.value))}
          className="mt-4 w-full cursor-pointer accent-twin-cyan"
          style={{ height: 8 }}
        />
        <div className="mt-1 flex justify-between font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>💰 Save money</span>
          <span>❄️ Keep it fresh</span>
        </div>

        {/* Live consequence */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-center">
          <div className="text-5xl">{o.spoiled ? "🥀" : o.qualityPct >= 80 ? "🥬" : "🥬"}</div>
          <div className="mt-2 font-mono text-3xl font-bold" style={{ color: qColor }}>
            {Math.max(0, o.qualityPct).toFixed(0)}% fresh
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-200">
            Your vegetables <span style={{ color: qColor }} className="font-semibold">{freshness}</span>.
          </p>
          <p className="mt-1.5 text-sm text-slate-400">{coolingLine}</p>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-slate-500">
            {o.reefer ? `Refrigerated @ ${o.setpointC} °C` : "Ambient truck — no refrigeration"}
          </div>
        </div>

        {/* The line that lands it */}
        <p
          className={`mt-5 text-center text-sm font-medium transition-colors ${
            o.qualityPct < 60 ? "text-amber-300" : "text-slate-500"
          }`}
        >
          This is why your vegetables sometimes arrive spoiled — someone, somewhere, chose to save a
          little money over the cold chain.
        </p>
      </div>
    </div>
  );
}
