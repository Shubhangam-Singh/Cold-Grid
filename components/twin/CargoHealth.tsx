"use client";

import type { Batch, ProduceId } from "@/lib/engine/types";
import { getProduce } from "@/lib/engine/produce";
import { degradationSnapshot } from "@/lib/engine/spoilage";
import { recommendSellPrice, type SellAdvice } from "@/lib/engine/pricing";

const ADVICE_CLASS: Record<SellAdvice, string> = {
  hold: "text-twin-emerald",
  markdown: "text-twin-amber",
  "sell-now": "text-orange-400",
  distress: "text-twin-danger",
  unsellable: "text-twin-danger",
};

function formatHours(h: number): string {
  if (!Number.isFinite(h)) return "stable";
  if (h <= 0) return "0 h";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

export default function CargoHealth({
  produce,
  batch,
  T_C,
  RH,
  VOC,
  compact = false,
}: {
  produce: ProduceId;
  batch: Batch;
  T_C: number;
  RH: number;
  VOC: number;
  compact?: boolean;
}) {
  const p = getProduce(produce);
  const snap = degradationSnapshot(batch, p, T_C, RH, VOC);
  const quote = recommendSellPrice({ produce, qualityPct: batch.quality });

  if (compact) {
    return (
      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] relative z-10">
        <span className="text-slate-400">
          {snap.rate.toFixed(1)}× · −{snap.qualityLossPerHour.toFixed(1)}%/h
        </span>
        <span className={ADVICE_CLASS[quote.advice]}>
          ₹{quote.recommendedRs}
          {quote.discountPct > 0 ? ` −${quote.discountPct}%` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-2.5">
      <div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
        Arrhenius · live
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Rate" value={`${snap.rate.toFixed(2)}×`} hint="vs 25°C" />
        <Stat label="Loss" value={`${snap.qualityLossPerHour.toFixed(1)}%/h`} />
        <Stat label="Left" value={formatHours(snap.remainingHours)} />
      </div>
      <div className="mt-2 flex items-end justify-between border-t border-white/5 pt-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
            Sell at
          </div>
          <div className={`font-mono text-lg font-bold leading-tight ${ADVICE_CLASS[quote.advice]}`}>
            ₹{quote.recommendedRs}
            <span className="ml-1 text-[10px] font-normal text-slate-500">/ unit</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-slate-400">list ₹{quote.basePriceRs}</div>
          <div className={`font-mono text-[10px] uppercase ${ADVICE_CLASS[quote.advice]}`}>
            {quote.grade} · {quote.discountPct > 0 ? `−${quote.discountPct}%` : "full"}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">{quote.reason}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-sm font-bold text-slate-100">{value}</div>
      {hint ? <div className="font-mono text-[8px] text-slate-600">{hint}</div> : null}
    </div>
  );
}
