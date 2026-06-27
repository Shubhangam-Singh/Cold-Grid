"use client";

/**
 * The CONSEQUENCE + DEBRIEF: per-delivery outcomes, the score breakdown, the
 * star rating, what the operator learned, and next steps. Closes the training
 * loop (spec §7.1).
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { SCENARIOS, getScenario } from "@/lib/academy/scenarios";
import { certificationLevel } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import { getProduce } from "@/lib/engine/produce";
import { qualityToRgb, rgbCss } from "@/components/twin/colors";
import type { DeliveryResult } from "@/lib/academy/run";
import { buildCausalChain, type CausalChain } from "@/lib/academy/causal";
import CausalModal from "./CausalModal";
import Stars from "./Stars";

// Lazy — pulls in recharts only when a decay curve is actually opened.
const DecayCurveModal = dynamic(() => import("@/components/dashboard/DecayCurveModal"), {
  ssr: false,
});

export default function ResultScreen() {
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const results = useAcademyStore((s) => s.results);
  const score = useAcademyStore((s) => s.score);
  const completed = useAcademyStore((s) => s.completed);
  const postScore = useAcademyStore((s) => s.postScore);
  const retry = useAcademyStore((s) => s.retry);
  const nextScenario = useAcademyStore((s) => s.nextScenario);
  const backToSelect = useAcademyStore((s) => s.backToSelect);
  const startAssessment = useAcademyStore((s) => s.startAssessment);
  const viewCertificate = useAcademyStore((s) => s.viewCertificate);
  const reflections = useAcademyStore((s) => s.reflections);
  const setReflection = useAcademyStore((s) => s.setReflection);
  const decisions = useAcademyStore((s) => s.decisions);

  const [curve, setCurve] = useState<DeliveryResult | null>(null);
  const [causal, setCausal] = useState<CausalChain | null>(null);

  if (!scenarioId || !results || !score) return null;
  const scenario = getScenario(scenarioId);
  const isLast = scenario.index === SCENARIOS.length;

  const totalStars = Object.values(completed).reduce((s, c) => s + c.stars, 0);
  const cert = certificationLevel(totalStars, SCENARIOS.length);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#07090d]/95 px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-400">
              Scenario {scenario.index} · Debrief
            </div>
            <h1 className="text-xl font-bold text-slate-100">{scenario.title}</h1>
          </div>
          <div className="text-right">
            <Stars value={score.stars} size="text-2xl" />
            <div className="font-mono text-2xl font-semibold text-slate-100">
              {score.composite.toFixed(0)}
              <span className="text-sm text-slate-500">/100</span>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Food saved" value={`${score.foodSavedPct.toFixed(0)}%`} />
          <Stat label="On-time" value={`${score.onTimePct.toFixed(0)}%`} />
          <Stat label="Community" value={`${score.foodSavedKg} kg`} />
          <Stat label="CO₂" value={`${score.co2Kg.toFixed(1)} kg`} />
          <Stat
            label="Energy"
            value={`${score.energyKwh.toFixed(1)} kWh`}
            warn={score.overBudget}
          />
        </div>
        {score.overBudget && (
          <div className="mt-2 rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            You exceeded the generator budget — that cost you points. Triage the cold next time.
          </div>
        )}

        {/* Per-delivery outcomes */}
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Deliveries
        </div>
        <ul className="mt-1.5 space-y-1.5">
          {results.map((r) => {
            const color = rgbCss(qualityToRgb(r.qualityPct));
            return (
              <li key={r.delivery.id} className="rounded bg-slate-900/70 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">
                    {getProduce(r.delivery.produce).label}
                    <span className="ml-1.5 font-mono text-[10px] text-slate-500">
                      {r.delivery.label}
                    </span>
                  </span>
                  <span className="font-mono text-sm font-semibold" style={{ color }}>
                    {r.dispatched ? `${r.qualityPct.toFixed(0)}%` : "not sent"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
                  <span>{r.reefer ? "❄ reefer" : "ambient"}</span>
                  <span>{r.transitHours.toFixed(1)} h transit</span>
                  <span className={r.onTime ? "text-emerald-400" : "text-amber-400"}>
                    {r.onTime ? "on time" : "late"}
                  </span>
                  {r.spoiled && <span className="text-red-400">⚠ spoiled</span>}
                  {r.dispatched && r.history.length >= 2 && (
                    <button
                      onClick={() => {
                        const d = decisions[r.delivery.id];
                        setCausal(
                          buildCausalChain({
                            produce: r.delivery.produce,
                            reefer: r.reefer,
                            setpointC: r.reefer ? d?.setpointC ?? null : null,
                            history: r.history,
                            finalQuality: r.qualityPct,
                            spoiled: r.spoiled,
                          })
                        );
                      }}
                      className={`ml-auto font-semibold underline-offset-2 hover:underline ${
                        r.spoiled || r.qualityPct < 50 ? "text-red-300" : "text-twin-cyan"
                      }`}
                    >
                      Understand why →
                    </button>
                  )}
                  {r.history.length >= 2 && (
                    <button
                      onClick={() => setCurve(r)}
                      className="text-sky-400 underline-offset-2 hover:underline"
                    >
                      decay curve →
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* What you learned */}
        <div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/30 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
            What you practiced
          </div>
          <p className="mt-1 text-sm text-slate-200">{scenario.learningObjective}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scenario.conceptTags.map((t) => (
              <span key={t} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Reflection — articulating the lesson cements it (shown on the certificate) */}
        <div className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/15 p-3">
          <label htmlFor="reflection" className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-amber">
            ✍ What would you do differently, and why?
          </label>
          <textarea
            id="reflection"
            value={reflections[scenarioId] ?? ""}
            onChange={(e) => setReflection(scenarioId, e.target.value)}
            rows={2}
            placeholder="One sentence on what you'd change next run — it'll appear on your certificate."
            className="mt-2 w-full resize-y rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-twin-amber/60 focus:outline-none"
          />
        </div>

        {isLast && (
          <div className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
              Certification
            </div>
            <div className="mt-1 text-lg font-bold text-slate-100">{cert.level}</div>
            <div className="font-mono text-sm text-amber-400">
              {totalStars}/{cert.maxStars}★ · {cert.pct.toFixed(0)}%
            </div>
            <p className="mt-1 text-xs text-slate-400">{cert.blurb}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button onClick={backToSelect} className="text-xs text-slate-500 transition hover:text-slate-300">
            ← Scenarios
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={retry}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
            >
              ↺ Retry
            </button>
            {!isLast ? (
              <button
                onClick={nextScenario}
                className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
              >
                Next scenario →
              </button>
            ) : (
              <button
                onClick={() => (postScore == null ? startAssessment("post") : viewCertificate())}
                className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
              >
                {postScore == null ? "Final assessment →" : "View certificate →"}
              </button>
            )}
          </div>
        </div>
      </div>

      {curve && (
        <DecayCurveModal
          history={curve.history}
          produce={curve.delivery.produce}
          title={`${getProduce(curve.delivery.produce).label} — ${curve.delivery.label}`}
          onClose={() => setCurve(null)}
        />
      )}

      {causal && <CausalModal chain={causal} onClose={() => setCausal(null)} />}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-900/70 p-2.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-lg font-semibold ${warn ? "text-red-400" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}
