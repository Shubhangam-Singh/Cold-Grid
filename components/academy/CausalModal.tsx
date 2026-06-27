"use client";

/**
 * The "Understand Why" modal — the core learning moment. Traces a delivery's
 * outcome back through the patented engine's reasoning to the operator's own
 * decision, as an animated four-step causal chain. This is the screen where the
 * lesson actually lands, so it's built to be the most polished in the app.
 */

import { motion } from "framer-motion";
import type { CausalChain } from "@/lib/academy/causal";

interface Props {
  chain: CausalChain;
  onClose: () => void;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};
const step = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function CausalModal({ chain, onClose }: Props) {
  const lost = chain.spoiled || chain.belowFreshness;
  const setpointLabel = chain.reefer
    ? `Refrigerated truck · setpoint ${chain.setpointC ?? "—"} °C`
    : "Ambient truck — no refrigeration";

  const damageLine = chain.breached
    ? `Temperature breach at hour ${fmt(chain.breachHour)} — and thermal memory (EMA) kept the cargo degrading faster even after it cooled.`
    : chain.breachHour != null
    ? `Quality crossed the ${chain.freshnessThreshold}% freshness line at hour ${fmt(chain.breachHour)}.`
    : "Stayed within the safe band the whole way — slow, controlled aging.";

  const outcomeLine = chain.spoiled
    ? `Final quality ${chain.finalQuality.toFixed(0)}% — spoiled, a total loss.`
    : chain.belowFreshness
    ? `Final quality ${chain.finalQuality.toFixed(0)}% — below the ${chain.freshnessThreshold}% freshness line.`
    : `Final quality ${chain.finalQuality.toFixed(0)}% — delivered fresh.`;

  const lesson = lost
    ? "A colder setpoint — or a faster route that cuts time in the heat — collapses the Arrhenius rate and saves this load."
    : "Well judged: you kept it under the safe ceiling, so the spoilage rate never spiked.";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-950 to-slate-900 p-6 shadow-[0_0_60px_rgba(0,0,0,0.7)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-slate-500 transition hover:text-white"
        >
          ✕
        </button>

        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
          Understand why
        </div>
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-xl font-bold text-white">{chain.produceLabel}</h2>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              lost ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {chain.spoiled ? "Spoiled" : chain.belowFreshness ? "Compromised" : "Delivered fresh"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">The model&apos;s reasoning, traced back to your call.</p>

        <motion.div variants={container} initial="hidden" animate="show" className="mt-5">
          <Step
            n={1}
            icon="🎛"
            title="Your decision"
            tone="cyan"
            body={setpointLabel}
          />
          <Connector label="set the temperature it travelled at" />
          <Step
            n={2}
            icon="🌡"
            title="Temperature effect"
            tone={chain.breached ? "red" : "amber"}
            body={`Cargo ${chain.reefer ? "held" : "rode"} at up to ${chain.peakTempC.toFixed(
              0
            )} °C (avg ${chain.avgTempC.toFixed(0)} °C). ${chain.produceLabel}'s safe ceiling is ${chain.safeCeilingC.toFixed(
              0
            )} °C.`}
            stat={`Arrhenius rate ×${chain.rateMultiplier.toFixed(1)}`}
            statSub="vs a 4 °C cold chain (Q10: ~×2–3 per 10 °C)"
          />
          <Connector label="raised the spoilage rate" />
          <Step n={3} icon="📉" title="Cumulative damage" tone="orange" body={damageLine} />
          <Connector label="consumed its shelf life" />
          <Step
            n={4}
            icon={lost ? "❌" : "✅"}
            title="Outcome"
            tone={lost ? "red" : "emerald"}
            body={outcomeLine}
          />
        </motion.div>

        <div className="mt-5 rounded-xl border border-twin-amber/25 bg-twin-amber/[0.07] p-3.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-twin-amber">The lesson</div>
          <p className="mt-1 text-sm font-medium text-slate-100">{lesson}</p>
        </div>
      </motion.div>
    </div>
  );
}

function fmt(h: number | null): string {
  return h == null ? "—" : h.toFixed(1);
}

const TONES: Record<string, { ring: string; bg: string; text: string }> = {
  cyan: { ring: "border-twin-cyan/40", bg: "bg-twin-cyan/[0.08]", text: "text-twin-cyan" },
  amber: { ring: "border-amber-500/40", bg: "bg-amber-500/[0.08]", text: "text-amber-400" },
  orange: { ring: "border-orange-500/40", bg: "bg-orange-500/[0.08]", text: "text-orange-400" },
  red: { ring: "border-red-500/40", bg: "bg-red-500/[0.08]", text: "text-red-400" },
  emerald: { ring: "border-emerald-500/40", bg: "bg-emerald-500/[0.08]", text: "text-emerald-400" },
};

function Step({
  n,
  icon,
  title,
  body,
  tone,
  stat,
  statSub,
}: {
  n: number;
  icon: string;
  title: string;
  body: string;
  tone: keyof typeof TONES | string;
  stat?: string;
  statSub?: string;
}) {
  const t = TONES[tone] ?? TONES.cyan;
  return (
    <motion.div variants={step} className={`rounded-xl border ${t.ring} ${t.bg} p-3.5`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${t.ring} bg-slate-950/60 text-sm`}>
          {icon}
        </span>
        <div className={`font-mono text-[10px] uppercase tracking-[0.2em] ${t.text}`}>
          {n} · {title}
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{body}</p>
      {stat && (
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-bold ${t.text}`}>{stat}</span>
          {statSub && <span className="text-[11px] text-slate-500">{statSub}</span>}
        </div>
      )}
    </motion.div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <motion.div variants={step} className="flex items-center gap-2 py-1.5 pl-3.5">
      <span className="text-lg leading-none text-slate-600">↓</span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    </motion.div>
  );
}
