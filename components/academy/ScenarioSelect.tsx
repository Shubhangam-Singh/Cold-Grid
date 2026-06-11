"use client";

import { SCENARIOS } from "@/lib/academy/scenarios";
import { certificationLevel } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import Stars from "./Stars";

export default function ScenarioSelect() {
  const completed = useAcademyStore((s) => s.completed);
  const openBriefing = useAcademyStore((s) => s.openBriefing);
  const preScore = useAcademyStore((s) => s.preScore);
  const postScore = useAcademyStore((s) => s.postScore);
  const startAssessment = useAcademyStore((s) => s.startAssessment);
  const viewCertificate = useAcademyStore((s) => s.viewCertificate);

  const totalStars = Object.values(completed).reduce((s, c) => s + c.stars, 0);
  const attempted = Object.keys(completed).length;
  const allDone = attempted === SCENARIOS.length;
  const cert = certificationLevel(totalStars, SCENARIOS.length);

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent px-6 py-8">
      <div className="mx-auto max-w-4xl pt-10">
        <h1 className="text-4xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">Operator Training Academy</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          You are Chennai&apos;s cold-chain duty officer. Handle five real-world crises, keep the
          city&apos;s food fresh, and earn your certification. Each scenario is graded on food
          saved, on-time delivery, and carbon efficiency.
        </p>

        {attempted > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
            <span className="font-mono text-2xl font-semibold text-amber-400">
              {totalStars}
              <span className="text-sm text-slate-500">/{SCENARIOS.length * 3}★</span>
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-200">{cert.level}</div>
              <div className="text-xs text-slate-500">{cert.blurb}</div>
            </div>
            {postScore != null && (
              <button
                onClick={viewCertificate}
                className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-900/40"
              >
                Certificate →
              </button>
            )}
          </div>
        )}

        {/* Assessment CTAs — measurable learning evidence */}
        {preScore == null ? (
          <button
            onClick={() => startAssessment("pre")}
            className="mt-4 w-full rounded-lg border border-sky-800/60 bg-sky-950/30 px-4 py-3 text-left transition hover:bg-sky-900/30"
          >
            <div className="text-sm font-semibold text-sky-300">① Take the pre-training assessment</div>
            <div className="text-xs text-slate-400">
              A quick 5-question quiz to baseline what you know — you&apos;ll retake it after training.
            </div>
          </button>
        ) : allDone && postScore == null ? (
          <button
            onClick={() => startAssessment("post")}
            className="mt-4 w-full rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-3 text-left transition hover:bg-emerald-900/30"
          >
            <div className="text-sm font-semibold text-emerald-300">② Take the post-training assessment</div>
            <div className="text-xs text-slate-400">
              You&apos;ve completed all five scenarios — measure your learning gain (pre-score {preScore.toFixed(0)}%).
            </div>
          </button>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const record = completed[s.id];
            return (
              <button
                key={s.id}
                onClick={() => openBriefing(s.id)}
                className="group relative overflow-hidden rounded-xl glass-panel p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgba(0,240,255,0.15)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-twin-cyan/0 via-transparent to-twin-cyan/0 opacity-0 transition-opacity duration-300 group-hover:opacity-10 group-hover:from-twin-cyan/20"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
                    Scenario {s.index}
                  </span>
                  {record ? <Stars value={record.stars} size="text-sm" /> : (
                    <span className="text-[10px] uppercase tracking-wider text-slate-600">
                      Not attempted
                    </span>
                  )}
                </div>
                <div className="relative z-10 mt-3 text-xl font-bold text-slate-100 transition-colors group-hover:text-white">{s.title}</div>
                <div className="relative z-10 text-xs text-slate-400">{s.subtitle}</div>
                <p className="relative z-10 mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500 transition-colors group-hover:text-slate-400">{s.learningObjective}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <a href="/" className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">
            ← Back to the live Twin
          </a>
        </div>
      </div>
    </div>
  );
}
