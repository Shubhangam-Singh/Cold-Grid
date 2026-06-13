/**
 * ComplianceEscrow (simulated). Settles payment against a temperature
 * attestation trace under one of two trust models — mirrors
 * contracts/ComplianceEscrow.sol.
 *
 *  - "off-chain-trust": pays on the supplier's SELF-REPORTED breaches. A
 *    cheater under-reports and gets paid in full; the buyer eats the loss.
 *  - "on-chain": the contract reads the ORACLE-attested truth from a
 *    tamper-evident ledger, so enforcement is automatic and fraud-proof.
 */

import { countBreaches } from "./attestation";
import { verifyChain } from "./ledger";
import type { EscrowTerms, LedgerBlock, Settlement, SettlementMode, TempAttestation } from "./types";

export function settle(opts: {
  mode: SettlementMode;
  terms: EscrowTerms;
  attestations: TempAttestation[];
  /** Required for on-chain mode — the ledger whose integrity is checked. */
  chain?: LedgerBlock[];
}): Settlement {
  const { mode, terms, attestations } = opts;
  const reportedBreaches = countBreaches(attestations, false);
  const trueBreaches = countBreaches(attestations, true);
  const fraudDetected = reportedBreaches < trueBreaches;

  let chainIntact = true;
  let breachesUsed: number;
  let explanation: string;

  if (mode === "off-chain-trust") {
    breachesUsed = reportedBreaches;
    explanation = fraudDetected
      ? `Settled on the supplier's self-reported ${reportedBreaches} breach(es). The cargo actually breached ${trueBreaches}× — the fraud is invisible, so the supplier is paid in full and the buyer eats spoiled goods.`
      : `Settled on the self-reported ${reportedBreaches} breach(es). Honest here — but nothing prevents the next log from being faked.`;
  } else {
    chainIntact = opts.chain ? verifyChain(opts.chain).intact : true;
    breachesUsed = trueBreaches;
    explanation = chainIntact
      ? `The contract settled automatically on the oracle-attested ${trueBreaches} breach(es). Under-reporting is pointless: every reading is on a tamper-evident ledger.`
      : `The ledger failed verification — a sealed block was altered. The contract refuses to release payment.`;
  }

  const over = Math.max(0, breachesUsed - terms.maxBreaches);
  const payoutRupees =
    mode === "on-chain" && !chainIntact
      ? 0
      : Math.max(0, terms.paymentRupees - over * terms.penaltyPerBreach);
  const withheldRupees = terms.paymentRupees - payoutRupees;

  return {
    mode,
    reportedBreaches,
    trueBreaches,
    breachesUsed,
    fraudDetected,
    chainIntact,
    payoutRupees,
    withheldRupees,
    explanation,
  };
}
