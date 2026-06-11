"use client";

import { SCENARIOS } from "@/lib/academy/scenarios";
import { certificationLevel } from "@/lib/academy/scoring";
import { useAcademyStore } from "@/store/academyStore";
import Stars from "./Stars";

export default function ScenarioSelect() {
  const completed = useAcademyStore((s) => s.completed);
  const openBriefing = useAcademyStore((s) => s.openBriefing);

  const totalStars = Object.values(completed).reduce((s, c) => s + c.stars, 0);
  const attempted = Object.keys(completed).length;
  const cert = certificationLevel(totalStars, SCENARIOS.length);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-100">Operator Training Academy</h1>
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
            <div>
              <div className="text-sm font-semibold text-slate-200">{cert.level}</div>
              <div className="text-xs text-slate-500">{cert.blurb}</div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const record = completed[s.id];
            return (
              <button
                key={s.id}
                onClick={() => openBriefing(s.id)}
                className="group rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-left transition hover:border-sky-700 hover:bg-slate-900/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
                    Scenario {s.index}
                  </span>
                  {record ? <Stars value={record.stars} size="text-sm" /> : (
                    <span className="text-[10px] uppercase tracking-wider text-slate-600">
                      Not attempted
                    </span>
                  )}
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-100">{s.title}</div>
                <div className="text-xs text-slate-400">{s.subtitle}</div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-500">{s.learningObjective}</p>
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
