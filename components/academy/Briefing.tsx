"use client";

import { getScenario } from "@/lib/academy/scenarios";
import { useAcademyStore } from "@/store/academyStore";

export default function Briefing() {
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const startOperate = useAcademyStore((s) => s.startOperate);
  const backToSelect = useAcademyStore((s) => s.backToSelect);
  if (!scenarioId) return null;
  const s = getScenario(scenarioId);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="max-w-2xl rounded-xl border border-slate-800 bg-slate-950/80 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-400">
          Scenario {s.index} · Briefing
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-100">{s.title}</h1>
        <div className="text-sm text-slate-400">{s.subtitle}</div>

        <div className="mt-4 space-y-3">
          {s.briefing.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-300">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/30 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
            Learning objective
          </div>
          <p className="mt-1 text-sm text-slate-200">{s.learningObjective}</p>
        </div>

        <ul className="mt-4 space-y-1.5">
          {s.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-400">
              <span className="text-amber-400">›</span>
              {h}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={backToSelect}
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            ← Scenarios
          </button>
          <button
            onClick={startOperate}
            className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
          >
            Enter the control room →
          </button>
        </div>
      </div>
    </div>
  );
}
