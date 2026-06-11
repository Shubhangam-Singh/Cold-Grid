"use client";

/**
 * The operator copilot (spec Phase 7). Shows physics-grounded advice from the
 * FREE heuristic engine by default; if NEXT_PUBLIC_ENABLE_COPILOT is true, an
 * "Ask the AI" button fetches a live Claude-written briefing and labels it.
 * On any failure it falls back to the heuristics — the app never depends on AI.
 */

import { useMemo, useState } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import {
  type Advice,
  type Severity,
  analyzeFleet,
  buildCopilotContext,
} from "@/lib/copilot/heuristics";

const COPILOT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COPILOT === "true";

const SEV_STYLE: Record<Severity, { dot: string; text: string }> = {
  critical: { dot: "bg-red-500", text: "text-red-300" },
  warn: { dot: "bg-amber-400", text: "text-amber-300" },
  info: { dot: "bg-sky-400", text: "text-sky-300" },
};

export default function CopilotPanel() {
  const sim = useColdgridStore((s) => s.sim);
  const [open, setOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const report = useMemo(() => analyzeFleet(sim), [sim]);

  async function askAI() {
    setLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: buildCopilotContext(sim) }),
      });
      const data = (await res.json()) as { enabled: boolean; text?: string; error?: string };
      if (data.enabled && data.text) {
        setAiText(data.text);
      } else {
        setAiError("AI copilot unavailable — showing the free heuristic advice.");
      }
    } catch {
      setAiError("AI copilot unreachable — showing the free heuristic advice.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        aria-expanded={false}
      >
        <span className="text-base">🧊</span> Copilot
        {report.atRisk > 0 && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
            {report.atRisk} at risk
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 max-h-[60vh] w-72 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/90 p-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Copilot
          </span>
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
              aiText ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/60 text-slate-300"
            }`}
          >
            {aiText ? "Live AI" : "Heuristic · free"}
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-200"
          aria-label="Close copilot"
        >
          ✕
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-400">{report.summary}</p>

      {aiText && (
        <div className="mt-2 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-2.5">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
            AI briefing
          </div>
          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-200">{aiText}</p>
        </div>
      )}

      <ul className="mt-2 space-y-2">
        {report.advice.length === 0 ? (
          <li className="py-2 text-center text-xs text-slate-500">
            All clear — no action needed right now.
          </li>
        ) : (
          report.advice.map((a) => <AdviceRow key={a.id} advice={a} />)
        )}
      </ul>

      {COPILOT_ENABLED && (
        <button
          onClick={askAI}
          disabled={loading}
          className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          {loading ? "Consulting Claude…" : "Ask the AI copilot"}
        </button>
      )}
      {aiError && <p className="mt-2 text-[11px] text-amber-400">{aiError}</p>}
      {!COPILOT_ENABLED && (
        <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] leading-snug text-slate-500">
          Free heuristic mode. Set NEXT_PUBLIC_ENABLE_COPILOT=true with an API key to enable the
          live Claude copilot.
        </p>
      )}
    </div>
  );
}

function AdviceRow({ advice }: { advice: Advice }) {
  const style = SEV_STYLE[advice.severity];
  return (
    <li className="rounded bg-slate-900/70 p-2">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
        <span className={`text-xs font-medium ${style.text}`}>{advice.title}</span>
        <span className="sr-only">{advice.severity}</span>
      </div>
      <p className="mt-0.5 pl-3.5 text-[11px] leading-snug text-slate-400">{advice.detail}</p>
    </li>
  );
}
