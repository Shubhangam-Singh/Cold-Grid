"use client";

/**
 * Operator controls (Phase 4): play/pause, speed, dispatch a few headline
 * shipments, a heatwave toggle (previews the Phase 5 scenario override), and
 * reset. All wired to the store's pure simulation actions.
 */

import { SPEEDS, useColdgridStore } from "@/store/coldgridStore";
import type { DispatchOptions } from "@/lib/engine/simulation";

const DISPATCHES: { label: string; opts: DispatchOptions }[] = [
  { label: "Fish · Kasimedu → Mylapore", opts: { produce: "fish", fromId: "kasimedu", toId: "mylapore" } },
  { label: "Milk · Aavin → Velachery", opts: { produce: "milk", fromId: "aavin-madhavaram", toId: "velachery" } },
  { label: "Tomato · Koyambedu → T. Nagar", opts: { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" } },
];

function btn(active = false) {
  return [
    "rounded px-2.5 py-1 text-xs font-medium transition",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400",
    active
      ? "bg-sky-500 text-slate-950"
      : "bg-slate-800 text-slate-200 hover:bg-slate-700",
  ].join(" ");
}

export default function SimControls() {
  const isPlaying = useColdgridStore((s) => s.isPlaying);
  const speed = useColdgridStore((s) => s.speed);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const togglePlay = useColdgridStore((s) => s.togglePlay);
  const setSpeed = useColdgridStore((s) => s.setSpeed);
  const dispatch = useColdgridStore((s) => s.dispatch);
  const resetSim = useColdgridStore((s) => s.resetSim);
  const setScenarioOffsetC = useColdgridStore((s) => s.setScenarioOffsetC);

  const heatwave = scenarioOffsetC > 0;

  return (
    <div className="absolute left-4 top-4 z-10 w-64 rounded-lg border border-slate-800 bg-slate-950/85 p-3 backdrop-blur">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Operations
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className={`${btn(isPlaying)} min-w-[64px]`}
          aria-pressed={isPlaying}
        >
          {isPlaying ? "❚❚ Pause" : "▶ Play"}
        </button>
        <div className="flex items-center gap-1" role="group" aria-label="Speed">
          {SPEEDS.map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              className={btn(speed === sp)}
              aria-pressed={speed === sp}
            >
              {sp}×
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        Dispatch
      </div>
      <div className="mt-1.5 space-y-1.5">
        {DISPATCHES.map((d) => (
          <button
            key={d.label}
            onClick={() => dispatch(d.opts)}
            className="block w-full rounded bg-slate-800 px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setScenarioOffsetC(heatwave ? 0 : 6)}
          className={btn(heatwave)}
          aria-pressed={heatwave}
        >
          {heatwave ? "🔥 Heatwave ON" : "Heatwave OFF"}
        </button>
        <button
          onClick={resetSim}
          className="rounded px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
