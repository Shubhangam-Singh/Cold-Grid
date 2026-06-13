"use client";

/**
 * Phase 9 — the Trust Layer page. Walks the NO-TRUST → CHEATING-EXPOSED →
 * ON-CHAIN-ENFORCEMENT arc on a real (simulated-engine) fish shipment, then lets
 * the visitor try to forge a sealed block and watch the ledger catch it.
 *
 * Default is the in-app SIMULATED ledger (NEXT_PUBLIC_ENABLE_CHAIN=false). The
 * oracle is the ColdGrid simulation; the real-world equivalent is Chainlink.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DEMO_TERMS,
  buildTrustArc,
  countBreaches,
  sampleShipmentHistory,
  settle,
  tamperReportedTemp,
  verifyChain,
} from "@/lib/chain";
import { getProduce } from "@/lib/engine/produce";
import BlockChainView from "./BlockChainView";
import SettlementCard from "./SettlementCard";

const CHAIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_CHAIN === "true";

export default function LedgerApp() {
  const history = useMemo(() => sampleShipmentHistory(), []);
  const arc = useMemo(() => buildTrustArc({ history }), [history]);

  const profile = getProduce(DEMO_TERMS.produce);
  const finalQuality = history[history.length - 1]?.quality ?? 100;
  const trueBreaches = countBreaches(arc[0].attestations, true);
  const onChainStage = arc[2];

  // Interactive tamper demo on the on-chain ledger.
  const [tamperedIndex, setTamperedIndex] = useState<number | null>(null);
  const tamperedChain =
    tamperedIndex != null ? tamperReportedTemp(onChainStage.chain, tamperedIndex, -5) : onChainStage.chain;
  const tamperVerification = useMemo(() => verifyChain(tamperedChain), [tamperedChain]);
  const tamperSettlement = useMemo(
    () => settle({ mode: "on-chain", terms: DEMO_TERMS, attestations: onChainStage.attestations, chain: tamperedChain }),
    [onChainStage.attestations, tamperedChain]
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
              Trust Layer
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-100">Why a tamper-proof cold-chain record matters</h1>
          </div>
          <Link href="/" className="font-mono text-[11px] text-slate-500 transition hover:text-twin-cyan">
            ← Twin
          </Link>
        </div>

        {/* Honesty banner */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          <span
            className={`mr-2 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              CHAIN_ENABLED ? "bg-twin-cyan/20 text-twin-cyan" : "bg-slate-700/60 text-slate-300"
            }`}
          >
            {CHAIN_ENABLED ? "On-chain mode" : "Simulated ledger · free"}
          </span>
          The oracle here is the ColdGrid simulation itself. In the real world that role is a
          decentralized oracle network such as <span className="text-slate-200">Chainlink</span> feeding
          signed sensor data; the same contract logic runs unchanged (see <code className="text-slate-300">/contracts</code>).
        </div>

        {/* Shipment context */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-100">
              🐟 {profile.label} shipment · Kasimedu → Mylapore
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              escrow ₹{DEMO_TERMS.paymentRupees.toLocaleString("en-IN")} · ≤{DEMO_TERMS.maxBreaches} breaches · −₹
              {DEMO_TERMS.penaltyPerBreach}/breach
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            The reefer failed and the load warmed past its {profile.thermalStressK - 273.15}°C limit — it really
            breached <span className="font-mono text-twin-danger">{trueBreaches}×</span> and arrived at{" "}
            <span className="font-mono text-twin-amber">{finalQuality.toFixed(0)}%</span> quality. Watch what each
            trust model pays the supplier.
          </p>
        </div>

        {/* Three-stage arc */}
        <div className="mt-6 space-y-5">
          {arc.map((stage) => (
            <section key={stage.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <h2 className="text-base font-semibold text-slate-100">{stage.title}</h2>
              <p className="mt-1 mb-3 text-xs leading-relaxed text-slate-400">{stage.blurb}</p>
              <BlockChainView chain={stage.chain} verification={verifyChain(stage.chain)} />
              <div className="mt-3">
                <SettlementCard settlement={stage.settlement} terms={DEMO_TERMS} />
              </div>
            </section>
          ))}
        </div>

        {/* Interactive tamper-evidence demo */}
        <section className="mt-6 rounded-xl border border-twin-cyan/30 bg-twin-cyan/5 p-4">
          <h2 className="text-base font-semibold text-slate-100">Try to break it</h2>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-slate-400">
            A fraudster can&apos;t just edit the ledger. Click any sealed block to forge its reading — the hash no
            longer matches, every later block&apos;s link breaks, and the escrow refuses to pay.
          </p>
          <BlockChainView
            chain={tamperedChain}
            verification={tamperVerification}
            interactive
            tamperedIndex={tamperedIndex}
            onTamper={setTamperedIndex}
          />
          <div className="mt-3">
            <SettlementCard settlement={tamperSettlement} terms={DEMO_TERMS} />
          </div>
          {tamperedIndex != null && (
            <button
              onClick={() => setTamperedIndex(null)}
              className="mt-3 rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
            >
              ↺ Restore the ledger
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
