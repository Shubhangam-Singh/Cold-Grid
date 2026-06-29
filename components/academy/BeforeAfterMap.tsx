"use client";

/**
 * Before & After Analysis — two side-by-side city-map snapshots of the same
 * scenario: the projected outcome at default settings (no cold-chain decisions)
 * vs the operator's actual outcome. Each delivery route is drawn from origin to
 * destination, the destination dot coloured by the delivered quality.
 */

import { getNode } from "@/lib/city/chennai";
import { qualityToRgb, rgbCss } from "@/components/twin/colors";
import type { DeliveryResult } from "@/lib/academy/run";
import type { Scenario } from "@/lib/academy/types";

const W = 230;
const H = 180;
const PAD = 20;

function makeProjector(scenario: Scenario) {
  const pts = scenario.requiredDeliveries.flatMap((d) => [
    getNode(d.fromId).coordinates,
    getNode(d.toId).coordinates,
  ]);
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  return ([lon, lat]: [number, number]): [number, number] => [
    PAD + ((lon - minLon) / (maxLon - minLon || 1)) * (W - 2 * PAD),
    PAD + (1 - (lat - minLat) / (maxLat - minLat || 1)) * (H - 2 * PAD),
  ];
}

function MiniMap({
  scenario,
  results,
  label,
  accent,
}: {
  scenario: Scenario;
  results: DeliveryResult[];
  label: string;
  accent: string;
}) {
  const project = makeProjector(scenario);
  const byId: Record<string, DeliveryResult> = {};
  for (const r of results) byId[r.delivery.id] = r;

  const dispatched = results.filter((r) => r.dispatched);
  const spoiled = results.filter((r) => r.spoiled).length;
  const avgQ =
    dispatched.length > 0
      ? dispatched.reduce((s, r) => s + r.qualityPct, 0) / dispatched.length
      : 0;

  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: accent }}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          {spoiled > 0 ? <span className="text-red-400">{spoiled} spoiled</span> : "0 spoiled"} · avg{" "}
          {avgQ.toFixed(0)}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-slate-800 bg-slate-950/60">
        {scenario.requiredDeliveries.map((d) => {
          const a = project(getNode(d.fromId).coordinates);
          const b = project(getNode(d.toId).coordinates);
          const r = byId[d.id];
          const q = r && r.dispatched ? r.qualityPct : 0;
          const color = q > 0 ? rgbCss(qualityToRgb(q)) : "#ef4444";
          return (
            <g key={d.id}>
              <line
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke={color} strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round"
              />
              <circle cx={a[0]} cy={a[1]} r={2} fill="#475569" />
              <circle cx={b[0]} cy={b[1]} r={4} fill={color} stroke="#0b1220" strokeWidth={0.8} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BeforeAfterMap({
  scenario,
  before,
  after,
}: {
  scenario: Scenario;
  before: DeliveryResult[];
  after: DeliveryResult[];
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan">
        Before &amp; After Analysis
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <MiniMap scenario={scenario} results={before} label="Before · default (no cold chain)" accent="#f87171" />
        <div className="hidden self-center text-slate-600 sm:block">→</div>
        <MiniMap scenario={scenario} results={after} label="After · your decisions" accent="#34d399" />
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Greener destinations arrived fresher. The left map is what happens with ambient trucks; the
        right is the outcome your cold-chain decisions actually produced.
      </p>
    </div>
  );
}
