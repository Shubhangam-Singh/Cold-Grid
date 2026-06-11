"use client";

/**
 * The signature teaching artifact (spec §8): a dual-axis decay curve explaining
 * WHY a batch spoiled. Quality is an area on the left axis over green/amber/red
 * zone bands; the EMA "effective temperature" (thermal memory) and the raw cargo
 * temperature run on the right axis; a reference line marks the at-risk breach.
 */

import { motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BatchHistoryPoint, ProduceId } from "@/lib/engine/types";
import { KELVIN } from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";

const AT_RISK = 60;
const CRITICAL = 35;

export interface DecayCurveModalProps {
  history: BatchHistoryPoint[];
  produce: ProduceId;
  title: string;
  onClose: () => void;
}

export default function DecayCurveModal({ history, produce, title, onClose }: DecayCurveModalProps) {
  const profile = getProduce(produce);
  const stressC = profile.thermalStressK - KELVIN;

  // effTemp = remembered thermal stress: Tstress + EMA·10 (°C). Lags the raw
  // cargo temperature — that lag IS the patented thermal memory.
  const data = history.map((p) => ({
    t: Number(p.ageHours.toFixed(2)),
    quality: Number(p.quality.toFixed(1)),
    cargoTemp: Number(p.T_C.toFixed(1)),
    effTemp: Number((stressC + p.ema * 10).toFixed(1)),
  }));

  const breach = data.find((d) => d.quality < AT_RISK);
  const spoil = data.find((d) => d.quality <= 0);
  const enough = data.length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Decay curve — ${title}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950 p-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
              Decay curve
            </div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            <div className="text-xs text-slate-500">
              {profile.label} · shelf life {profile.shelfLifeHours} h @ 25 °C · stress &gt;{" "}
              {stressC.toFixed(0)} °C
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {enough ? (
          <>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                  {/* quality zone bands (left axis) */}
                  <ReferenceArea yAxisId="q" y1={AT_RISK} y2={100} fill="#22c55e" fillOpacity={0.06} />
                  <ReferenceArea yAxisId="q" y1={CRITICAL} y2={AT_RISK} fill="#eab308" fillOpacity={0.07} />
                  <ReferenceArea yAxisId="q" y1={0} y2={CRITICAL} fill="#ef4444" fillOpacity={0.07} />

                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={[0, "dataMax"]}
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    label={{ value: "hours in transit", position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    yAxisId="q"
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    width={34}
                  />
                  <YAxis
                    yAxisId="temp"
                    orientation="right"
                    stroke="#f97316"
                    tick={{ fontSize: 10, fontFamily: "monospace" }}
                    width={34}
                    unit="°"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(2,6,23,0.95)",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(value, name) => {
                      const v = Number(value);
                      const key = String(name);
                      return [
                        key === "quality" ? `${v}%` : `${v}°C`,
                        key === "quality" ? "Quality" : key === "effTemp" ? "EMA eff. temp" : "Cargo temp",
                      ];
                    }}
                    labelFormatter={(l) => `${l} h`}
                  />

                  <Area
                    yAxisId="q"
                    type="monotone"
                    dataKey="quality"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    fill="#38bdf8"
                    fillOpacity={0.18}
                    isAnimationActive={false}
                    dot={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="cargoTemp"
                    stroke="#475569"
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="effTemp"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {breach && (
                    <ReferenceLine
                      yAxisId="q"
                      x={breach.t}
                      stroke="#eab308"
                      strokeDasharray="4 3"
                      label={{ value: "at-risk", fontSize: 10, fill: "#eab308", position: "top" }}
                    />
                  )}
                  {spoil && (
                    <ReferenceLine
                      yAxisId="q"
                      x={spoil.t}
                      stroke="#ef4444"
                      strokeDasharray="4 3"
                      label={{ value: "spoiled", fontSize: 10, fill: "#ef4444", position: "top" }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <Legend color="#38bdf8" label="Quality (left)" />
              <Legend color="#f97316" label="EMA effective temp (right)" />
              <Legend color="#475569" label="Cargo temp (right)" />
            </div>
            <p className="mt-3 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-400">
              The orange <span className="text-orange-400">EMA effective temperature</span> lags the
              grey cargo temperature — that lag is the patented <em>thermal memory</em>: heat
              exposure keeps driving spoilage even after the cargo is re-cooled. Quality falls fastest
              while the effective temperature is high.
            </p>
          </>
        ) : (
          <p className="py-12 text-center text-sm text-slate-500">
            Not enough data yet — let this shipment travel a little longer.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
