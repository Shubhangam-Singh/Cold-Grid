"use client";

/**
 * Academy orchestrator: renders the right phase (select → briefing → operate →
 * running → result), hosts the twin map during the operate/run phases, and
 * watches the shared simulation to end the run when every shipment has arrived.
 */

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useAcademyStore } from "@/store/academyStore";
import { useColdgridStore } from "@/store/coldgridStore";
import ScenarioSelect from "./ScenarioSelect";
import Briefing from "./Briefing";
import OperatorConsole from "./OperatorConsole";
import ResultScreen from "./ResultScreen";
import SimulationClock from "@/components/twin/SimulationClock";
import MapLegend from "@/components/twin/MapLegend";

const DeckMap = dynamic(() => import("@/components/twin/DeckMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#07090d]">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
        Loading control room…
      </span>
    </div>
  ),
});

function RunningBanner() {
  const finishRun = useAcademyStore((s) => s.finishRun);
  return (
    <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg border border-slate-800 bg-slate-950/90 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
          ● Running the day…
        </span>
        <button
          onClick={finishRun}
          className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-slate-700"
        >
          Skip to results
        </button>
      </div>
    </div>
  );
}

export default function AcademyApp() {
  const phase = useAcademyStore((s) => s.phase);
  const finishRun = useAcademyStore((s) => s.finishRun);
  const shipments = useColdgridStore((s) => s.sim.shipments);

  // End the run once every dispatched shipment has been delivered.
  useEffect(() => {
    if (
      phase === "running" &&
      shipments.length > 0 &&
      shipments.every((s) => s.status === "delivered")
    ) {
      finishRun();
    }
  }, [phase, shipments, finishRun]);

  const mapPhase = phase === "operate" || phase === "running";

  return (
    <main className="flex h-screen flex-col bg-[#07090d]">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <a href="/" className="text-lg font-bold tracking-tight text-slate-100 hover:text-white">
            ColdGrid
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
            Academy
          </span>
        </div>
        <a href="/" className="font-mono text-[11px] text-slate-500 hover:text-slate-300">
          Live Twin →
        </a>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {mapPhase && (
          <>
            <DeckMap />
            <SimulationClock />
            <MapLegend />
          </>
        )}
        {phase === "select" && <ScenarioSelect />}
        {phase === "briefing" && <Briefing />}
        {phase === "operate" && <OperatorConsole />}
        {phase === "running" && <RunningBanner />}
        {phase === "result" && <ResultScreen />}
      </div>
    </main>
  );
}
