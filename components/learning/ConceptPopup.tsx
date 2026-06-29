"use client";

/**
 * The contextual concept card itself — a small dismissible pop-up that appears
 * bottom-center when a learning moment fires. Concept name + one plain sentence
 * + one Chennai example + a "Got it" button.
 */

import { AnimatePresence, motion } from "framer-motion";
import { CONCEPTS } from "@/lib/learning/concepts";
import { useLearningStore } from "@/store/learningStore";

export default function ConceptPopup() {
  const pendingId = useLearningStore((s) => s.pendingId);
  const dismiss = useLearningStore((s) => s.dismiss);
  const concept = pendingId ? CONCEPTS[pendingId] : null;

  return (
    <AnimatePresence>
      {concept && (
        <motion.div
          key={concept.id}
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="pointer-events-auto fixed bottom-5 left-1/2 z-[130] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-twin-cyan/30 bg-slate-950/95 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.6)] backdrop-blur"
          role="dialog"
          aria-live="polite"
        >
          <div className="absolute -top-px left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-twin-cyan/60 to-transparent" />
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{concept.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-twin-cyan text-glow">
                Concept · {concept.name}
              </div>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-100">
                {concept.sentence}
              </p>
              <p className="mt-2 border-l-2 border-twin-amber/40 pl-2.5 text-xs italic leading-relaxed text-slate-400">
                {concept.chennaiExample}
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={dismiss}
                  className="rounded-lg border border-twin-cyan/50 bg-twin-cyan/15 px-4 py-1.5 text-xs font-bold text-twin-cyan transition hover:bg-twin-cyan/25 active:scale-95"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
