"use client";

/**
 * Demo Mode (spec Phase 8): launches the fixed-seed scripted run and narrates
 * it with captions for the competition video. The controller fires each script
 * step when the deterministic sim clock crosses its time, so the run is
 * identical on every replay (RULE 4). Manual controls still work — this just
 * drives the same store actions an operator would.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useColdgridStore } from "@/store/coldgridStore";
import {
  DEMO_DURATION_HOURS,
  DEMO_SCRIPT,
  DEMO_SEED,
  DEMO_START_HOUR,
  type DemoAction,
} from "@/lib/demo/script";

export default function DemoMode() {
  const demoActive = useColdgridStore((s) => s.demoActive);
  const clockHours = useColdgridStore((s) => s.sim.clockHours);
  const setDemoActive = useColdgridStore((s) => s.setDemoActive);

  const [caption, setCaption] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const firedRef = useRef(0);

  function applyActions(actions: DemoAction[] | undefined) {
    if (!actions) return;
    const s = useColdgridStore.getState();
    for (const a of actions) {
      if (a.type === "dispatch") s.dispatch(a.opts);
      else if (a.type === "scenario") s.setScenarioOffsetC(a.offsetC);
      else if (a.type === "speed") s.setSpeed(a.speed);
      else if (a.type === "heatmap") s.setHeatmap(a.on);
    }
  }

  function start() {
    const s = useColdgridStore.getState();
    firedRef.current = 0;
    setFinished(false);
    setCaption(null);
    s.setHeatmap(false);
    s.setScenarioOffsetC(0);
    s.resetToSeed(DEMO_SEED, DEMO_START_HOUR);
    setDemoActive(true);
    s.play();
  }

  function exit() {
    const s = useColdgridStore.getState();
    s.pause();
    s.setHeatmap(false);
    s.setScenarioOffsetC(0);
    s.resetSim();
    setDemoActive(false);
    setFinished(false);
    setCaption(null);
  }

  // Fire scripted steps as the deterministic sim clock advances.
  useEffect(() => {
    if (!demoActive || finished) return;
    while (
      firedRef.current < DEMO_SCRIPT.length &&
      DEMO_SCRIPT[firedRef.current].atHours <= clockHours
    ) {
      const step = DEMO_SCRIPT[firedRef.current];
      applyActions(step.actions);
      setCaption(step.caption);
      firedRef.current += 1;
    }
    if (clockHours >= DEMO_DURATION_HOURS) {
      useColdgridStore.getState().pause();
      setFinished(true);
    }
    // applyActions only reads the store via getState() — intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive, finished, clockHours]);

  const progress = Math.min(100, (clockHours / DEMO_DURATION_HOURS) * 100);

  if (!demoActive) {
    return (
      <button
        onClick={start}
        className="absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full glass-pill px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-twin-cyan transition-all duration-300 hover:scale-105 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
        aria-label="Start scripted Demo Mode"
      >
        🎬 Demo Mode
      </button>
    );
  }

  return (
    <>
      {/* Top indicator + progress */}
      <div className="absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full glass-pill px-4 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-twin-cyan">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-twin-cyan" aria-hidden />
          Demo
        </span>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-700/60" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-twin-cyan transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={exit}
          className="font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
        >
          Exit
        </button>
      </div>

      {/* Caption banner (announced to screen readers) */}
      <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 w-full max-w-xl -translate-x-1/2 px-4" aria-live="polite">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.div
              key={caption}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="rounded-xl glass-panel px-5 py-3 text-center text-sm leading-relaxed text-slate-100 shadow-2xl"
            >
              {caption}
            </motion.div>
          )}
        </AnimatePresence>
        {finished && (
          <div className="pointer-events-auto mt-3 flex justify-center gap-2">
            <button
              onClick={start}
              className="rounded-lg bg-twin-cyan/20 px-4 py-1.5 text-xs font-semibold text-twin-cyan transition hover:bg-twin-cyan/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
            >
              ↻ Replay
            </button>
            <button
              onClick={exit}
              className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
            >
              Exit demo
            </button>
          </div>
        )}
      </div>
    </>
  );
}
