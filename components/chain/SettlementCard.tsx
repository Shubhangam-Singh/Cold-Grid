"use client";

/** Shows how a ComplianceEscrow settlement resolved — payout, fraud, integrity. */

import { type EscrowTerms, type Settlement, settlementImpact } from "@/lib/chain";

export default function SettlementCard({
  settlement: s,
  terms,
}: {
  settlement: Settlement;
  terms: EscrowTerms;
}) {
  const fullPay = s.payoutRupees >= terms.paymentRupees;
  const tone = !s.chainIntact
    ? "border-twin-danger/50 bg-twin-danger/10"
    : s.fraudDetected && s.mode === "off-chain-trust"
      ? "border-twin-danger/50 bg-twin-danger/10"
      : fullPay
        ? "border-twin-emerald/40 bg-twin-emerald/10"
        : "border-twin-amber/40 bg-twin-amber/10";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Escrow settlement · {s.mode === "on-chain" ? "on-chain" : "off-chain trust"}
        </span>
        {s.fraudDetected && (
          <span className="rounded bg-twin-danger/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-twin-danger">
            fraud {s.mode === "on-chain" ? "neutralized" : "undetected"}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Reported breaches" value={String(s.reportedBreaches)} />
        <Stat label="True breaches" value={String(s.trueBreaches)} accent={s.trueBreaches > terms.maxBreaches ? "text-twin-danger" : undefined} />
        <Stat label="Settled on" value={String(s.breachesUsed)} accent="text-twin-cyan" />
      </div>

      <div className="mt-3 flex items-end justify-between border-t border-white/5 pt-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Supplier paid</div>
          <div className={`font-mono text-2xl font-bold ${fullPay ? "text-twin-emerald" : "text-twin-amber"}`}>
            ₹{s.payoutRupees.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Withheld</div>
          <div className="font-mono text-lg font-semibold text-slate-300">
            ₹{s.withheldRupees.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{s.explanation}</p>

      {(() => {
        const impact = settlementImpact(s, terms.produce);
        if (!impact.note) return null;
        return (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-white/5 bg-slate-950/40 p-2.5">
            <span className="text-base leading-none">🍽️</span>
            <p className="text-[11px] leading-relaxed text-slate-300">{impact.note}</p>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-slate-900/50 p-2">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-mono text-lg font-bold ${accent ?? "text-slate-100"}`}>{value}</div>
    </div>
  );
}
