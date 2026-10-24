"use client";

/**
 * Add-on ledger fed by the PPSC cart. The scripted lesson on this page is
 * untouched. This section stays empty until the operator turns the cart on.
 */

import { useMemo } from "react";
import { countBreaches } from "@/lib/chain";
import { LIVE_SHIPMENT_ID, verifyOpenChain } from "@/lib/hardware/liveSession";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";
import CartToggle from "@/components/hardware/CartToggle";
import BlockChainView from "./BlockChainView";
import LiveChainStatus from "./LiveChainStatus";

const WINDOW = 48;

export default function LiveCartLedger() {
  const chain = useLiveHardwareStore((s) => s.session.chain);
  const reading = useLiveHardwareStore((s) => s.session.reading);
  const clearSession = useLiveHardwareStore((s) => s.clearSession);
  const verification = useMemo(() => verifyOpenChain(chain), [chain]);
  const breaches = countBreaches(
    chain.map((block) => block.attestation),
    true
  );
  const shown = chain.slice(-WINDOW);

  return (
    <section className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Live cart ledger</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Oracle is the PPSC cart on USB. Each new sample seals a block for{" "}
            <span className="font-mono text-slate-300">{LIVE_SHIPMENT_ID}</span>. The lesson below
            stays on its scripted shipment.
          </p>
        </div>
        <div className="w-40 shrink-0">
          <CartToggle compact />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <span>{chain.length} blocks</span>
        <span className={breaches > 0 ? "text-twin-danger" : "text-twin-emerald"}>
          {breaches} breaches
        </span>
        {reading && <span>last {reading.tempC.toFixed(1)}°C</span>}
      </div>

      <div className="mt-3">
        {chain.length === 0 ? (
          <p className="text-xs text-slate-500">
            Turn on real readings and start the bridge. Blocks appear here as the cart reports.
          </p>
        ) : (
          <BlockChainView chain={shown} verification={verification} />
        )}
      </div>

      {chain.length > WINDOW && (
        <p className="mt-2 font-mono text-[10px] text-slate-500">
          Showing the latest {WINDOW} of {chain.length}.
        </p>
      )}

      {chain.length > 0 && (
        <button
          type="button"
          onClick={() => clearSession()}
          className="mt-3 rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan"
        >
          Clear live session
        </button>
      )}
      <LiveChainStatus />
    </section>
  );
}
