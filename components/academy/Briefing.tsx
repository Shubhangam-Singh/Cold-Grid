"use client";

import { getScenario } from "@/lib/academy/scenarios";
import { useAcademyStore } from "@/store/academyStore";
import { motion, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function Briefing() {
  const scenarioId = useAcademyStore((s) => s.scenarioId);
  const startOperate = useAcademyStore((s) => s.startOperate);
  const backToSelect = useAcademyStore((s) => s.backToSelect);
  if (!scenarioId) return null;
  const s = getScenario(scenarioId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="flex h-full w-full items-center justify-center overflow-y-auto bg-transparent px-4 sm:px-6 py-6 sm:py-8"
    >
      <div className="relative max-w-2xl w-full rounded-2xl glass-panel p-5 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin-cyan/50 to-transparent"></div>
        
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <motion.div variants={itemVariants} className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
            Scenario {s.index} · Briefing
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="mt-2 text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            {s.title}
          </motion.h1>
          
          <motion.div variants={itemVariants} className="mt-1 text-sm text-slate-400">
            {s.subtitle}
          </motion.div>

          {/* What-If panel — sets the learning intention before play */}
          {(s.whatYouWillLearn || s.whatIfQuestion || s.realWorldParallel) && (
            <motion.div variants={itemVariants} className="mt-6 grid gap-2.5">
              {s.whatYouWillLearn && (
                <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-400">
                    🎯 What you&apos;ll learn
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">{s.whatYouWillLearn}</p>
                </div>
              )}
              {s.whatIfQuestion && (
                <div className="rounded-xl border border-twin-amber/30 bg-twin-amber/[0.07] p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-amber">
                    💭 What if…
                  </div>
                  <p className="mt-1 text-sm font-medium italic text-amber-100">{s.whatIfQuestion}</p>
                </div>
              )}
              {s.realWorldParallel && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
                    🌍 Real-world parallel
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{s.realWorldParallel}</p>
                </div>
              )}
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="mt-6 space-y-4">
            {s.briefing.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-slate-300">
                {p}
              </p>
            ))}
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6 rounded-xl border border-twin-cyan/20 bg-twin-cyan/5 p-4 shadow-inner">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-cyan">
              Learning objective
            </div>
            <p className="mt-2 text-sm font-medium text-slate-200">{s.learningObjective}</p>
          </motion.div>

          <motion.ul variants={itemVariants} className="mt-6 space-y-2">
            {s.hints.map((h, i) => (
              <li key={i} className="flex gap-3 text-xs text-slate-400">
                <span className="text-twin-amber text-glow">›</span>
                {h}
              </li>
            ))}
          </motion.ul>

          {/* Crisis / scenario hazard badges */}
          <motion.div variants={itemVariants} className="mt-5 flex flex-wrap gap-2">
            {s.crisisEnabled === false ? (
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-mono text-sky-400 uppercase tracking-widest">
                🎓 Tutorial — No crises
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-mono text-amber-400 uppercase tracking-widest">
                ⚡ Mid-transit crises enabled
              </span>
            )}
            {s.closedEdgeIds.length > 0 && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-mono text-blue-400 uppercase tracking-widest">
                🌊 {s.closedEdgeIds.length} road{s.closedEdgeIds.length > 1 ? "s" : ""} flooded
              </span>
            )}
            {s.forcedCrises && s.forcedCrises.length > 0 && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-mono text-red-400 uppercase tracking-widest">
                🚨 {s.forcedCrises.length} scripted event{s.forcedCrises.length > 1 ? "s" : ""} incoming
              </span>
            )}
            {s.energyBudgetKwh < 10 && (
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[10px] font-mono text-purple-400 uppercase tracking-widest">
                🔋 Tight energy budget: {s.energyBudgetKwh} kWh
              </span>
            )}
          </motion.div>

          <motion.div variants={itemVariants} className="mt-10 flex items-center justify-between border-t border-white/5 pt-6">
            <button
              onClick={backToSelect}
              className="font-mono text-xs uppercase tracking-wider text-slate-500 transition hover:text-twin-cyan hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]"
            >
              ← Abort
            </button>
            <button
              onClick={startOperate}
              className="group relative overflow-hidden rounded-md border border-twin-cyan/50 bg-twin-cyan/20 px-6 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.1em] text-twin-cyan shadow-[0_0_15px_rgba(0,240,255,0.2)] transition hover:scale-105 hover:bg-twin-cyan/30 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
            >
              <span className="relative z-10 flex items-center gap-2">
                Awaiting Operator <span className="animate-pulse">_</span>
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-twin-cyan/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
