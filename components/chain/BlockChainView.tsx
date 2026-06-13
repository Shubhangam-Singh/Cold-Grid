"use client";

/**
 * Visual hash-linked ledger: each attestation block shows its reported temp,
 * the breach flag, and its hash link to the previous block. When interactive,
 * clicking a block forges its reading (without re-hashing) so you can watch
 * verifyChain() catch the tamper — the whole point of a tamper-evident ledger.
 */

import type { ChainVerification, LedgerBlock } from "@/lib/chain";
import { rgbCss, tempToRgb } from "@/components/twin/colors";

export default function BlockChainView({
  chain,
  verification,
  interactive = false,
  tamperedIndex = null,
  onTamper,
}: {
  chain: LedgerBlock[];
  verification: ChainVerification;
  interactive?: boolean;
  tamperedIndex?: number | null;
  onTamper?: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${verification.intact ? "bg-twin-emerald" : "bg-twin-danger animate-pulse"}`}
          aria-hidden
        />
        <span className={`font-mono text-[11px] ${verification.intact ? "text-twin-emerald" : "text-twin-danger"}`}>
          {verification.reason}
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {chain.map((b, i) => {
          const breach = b.attestation.reportedTempC > b.attestation.thresholdC;
          const broken = !verification.intact && verification.brokenAtIndex != null && i >= verification.brokenAtIndex;
          const forged = tamperedIndex === i;
          const tColor = rgbCss(tempToRgb(b.attestation.reportedTempC));
          return (
            <div key={b.index} className="flex items-center">
              {i > 0 && (
                <span className={`px-0.5 font-mono text-[10px] ${broken ? "text-twin-danger" : "text-slate-600"}`}>→</span>
              )}
              <button
                disabled={!interactive}
                onClick={() => onTamper?.(i)}
                title={
                  interactive
                    ? "Click to forge this reading (simulate tampering)"
                    : `Block ${b.index} · ${b.hash}`
                }
                className={[
                  "min-w-[58px] rounded-md border px-1.5 py-1 text-center transition",
                  interactive ? "cursor-pointer hover:border-twin-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan" : "cursor-default",
                  forged
                    ? "border-twin-danger bg-twin-danger/20"
                    : broken
                      ? "border-twin-danger/40 bg-twin-danger/5"
                      : "border-slate-700 bg-slate-900/60",
                ].join(" ")}
              >
                <div className="font-mono text-[9px] text-slate-500">#{b.index}</div>
                <div className="font-mono text-xs font-bold" style={{ color: tColor }}>
                  {b.attestation.reportedTempC.toFixed(0)}°
                </div>
                <div className={`font-mono text-[8px] uppercase ${breach ? "text-twin-danger" : "text-twin-emerald"}`}>
                  {breach ? "breach" : "ok"}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
