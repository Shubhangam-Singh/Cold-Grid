"use client";

/**
 * The certificate (spec §7.3 / §11): operator certification level plus the
 * measurable PRE → POST assessment delta — the competition's learning evidence.
 */

import { SCENARIOS } from "@/lib/academy/scenarios";
import { certificationLevel } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import Stars from "./Stars";

export default function CertificateScreen() {
  const completed = useAcademyStore((s) => s.completed);
  const preScore = useAcademyStore((s) => s.preScore);
  const postScore = useAcademyStore((s) => s.postScore);
  const backToSelect = useAcademyStore((s) => s.backToSelect);

  const totalStars = Object.values(completed).reduce((s, c) => s + c.stars, 0);
  const totalFoodDiverted = Object.values(completed).reduce((s, c) => s + (c.foodSavedKg || 0), 0);
  const cert = certificationLevel(totalStars, SCENARIOS.length);
  const delta = preScore != null && postScore != null ? postScore - preScore : null;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="w-full max-w-xl rounded-2xl border border-amber-800/50 bg-gradient-to-b from-slate-950 to-slate-900 p-7 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-400">
          ColdGrid Operator Certification
        </div>
        <div className="mt-3 text-3xl font-bold text-slate-100">{cert.level}</div>
        <div className="mt-1 font-mono text-amber-400">
          {totalStars}/{cert.maxStars}★ · {cert.pct.toFixed(0)}%
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">{cert.blurb}</p>

        {/* Learning gain */}
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
            Measured learning gain
          </div>
          {preScore != null && postScore != null ? (
            <div className="mt-2 flex items-center justify-center gap-4">
              <Score label="Before" value={preScore} />
              <span className="text-2xl text-slate-600">→</span>
              <Score label="After" value={postScore} />
              <div className="ml-2 rounded-lg bg-emerald-950/40 px-3 py-1.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Δ Gain</div>
                <div className={`font-mono text-xl font-bold ${delta! >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {delta! >= 0 ? "+" : ""}
                  {delta!.toFixed(0)} pts
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Take the pre- and post-training assessments to measure your gain.
            </p>
          )}
        </div>

        {/* Per-scenario stars */}
        <div className="mt-5 grid grid-cols-1 gap-1.5 text-left sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const rec = completed[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between rounded bg-slate-900/60 px-3 py-1.5">
                <span className="text-xs text-slate-300">
                  {s.index}. {s.title}
                </span>
                {rec ? <Stars value={rec.stars} size="text-xs" /> : <span className="text-[10px] text-slate-600">—</span>}
              </div>
            );
          })}
        </div>

        {totalFoodDiverted >= 3000 && (
          <div className="mt-5 rounded-xl border border-twin-emerald/30 bg-twin-emerald/10 p-3 text-center">
            <div className="text-2xl mb-1">🌱</div>
            <div className="font-bold text-twin-emerald">Zero Waste Operator</div>
            <div className="text-xs text-slate-400 mt-1">You diverted {totalFoodDiverted} kg of near-spoiled food to community kitchens!</div>
          </div>
        )}

        <button
          onClick={backToSelect}
          className="mt-6 rounded-lg border border-slate-700 px-5 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          Back to scenarios
        </button>
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-xl font-semibold text-slate-100">{value.toFixed(0)}%</div>
    </div>
  );
}
