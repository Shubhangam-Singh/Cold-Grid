/**
 * The trust arc (Phase 9 teaching core): NO-TRUST → CHEATING-EXPOSED →
 * ON-CHAIN-ENFORCEMENT, as pure data the UI renders. Deterministic (RULE 4).
 *
 * The cargo's true temperature trace comes from the patented spoilage engine
 * (RULE 1: we only READ it), so the same physics that spoils the fish also
 * drives the attestations — the fraud is hiding a real, simulated loss.
 */

import type { BatchHistoryPoint, ProduceId } from "../engine/types";
import { createBatch, stepBatch } from "../engine/spoilage";
import { getProduce } from "../engine/produce";
import { buildAttestations } from "./attestation";
import { buildChain } from "./ledger";
import { settle } from "./escrow";
import type { EscrowTerms, LedgerBlock, Settlement, TempAttestation } from "./types";

export const DEMO_SHIPMENT_ID = "SHP-CHN-7";
export const DEMO_PRODUCE: ProduceId = "fish";

export const DEMO_TERMS: EscrowTerms = {
  produce: DEMO_PRODUCE,
  paymentRupees: 5000,
  maxBreaches: 4,
  penaltyPerBreach: 300,
};

/**
 * A deterministic, physics-real transit history: a fish load whose cold chain
 * warms from 18 °C to ~34 °C over the run (a failing reefer), passing the 25 °C
 * threshold partway — so there are genuine breaches AND genuine spoilage.
 */
export function sampleShipmentHistory(produce: ProduceId = DEMO_PRODUCE): BatchHistoryPoint[] {
  const profile = getProduce(produce);
  let batch = createBatch(DEMO_SHIPMENT_ID, produce);
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const ambient = 18 + i; // 18 → 33 °C
    batch = stepBatch(batch, profile, ambient, 80, profile.vocRef, 0.25);
  }
  return batch.history;
}

export interface ArcStage {
  id: "off-chain-honest" | "off-chain-cheat" | "on-chain";
  title: string;
  blurb: string;
  attestations: TempAttestation[];
  chain: LedgerBlock[];
  settlement: Settlement;
}

/** Build the three-stage trust arc for one shipment history + escrow terms. */
export function buildTrustArc(opts: {
  shipmentId?: string;
  produce?: ProduceId;
  history?: BatchHistoryPoint[];
  terms?: EscrowTerms;
}): ArcStage[] {
  const shipmentId = opts.shipmentId ?? DEMO_SHIPMENT_ID;
  const produce = opts.produce ?? DEMO_PRODUCE;
  const history = opts.history ?? sampleShipmentHistory(produce);
  const terms = opts.terms ?? DEMO_TERMS;

  const honest = buildAttestations({ shipmentId, produce, history, postedBy: "transporter" });
  const cheat = buildAttestations({ shipmentId, produce, history, postedBy: "transporter", cheat: true });

  const honestChain = buildChain(honest);
  const cheatChain = buildChain(cheat);

  return [
    {
      id: "off-chain-honest",
      title: "1 · A trust-based world",
      blurb:
        "The transporter self-reports temperatures to a private logbook. Honest today — but the buyer has no way to prove it. Payment rides on a promise.",
      attestations: honest,
      chain: honestChain,
      settlement: settle({ mode: "off-chain-trust", terms, attestations: honest }),
    },
    {
      id: "off-chain-cheat",
      title: "2 · The logbook is faked",
      blurb:
        "Next run, the transporter simply edits the logbook — every reading shows 'cold'. The fish still spoiled, but the paperwork is spotless, so they collect full payment and the buyer eats the loss.",
      attestations: cheat,
      chain: cheatChain,
      settlement: settle({ mode: "off-chain-trust", terms, attestations: cheat }),
    },
    {
      id: "on-chain",
      title: "3 · On-chain attestation",
      blurb:
        "Now each reading is attested to a tamper-evident ledger by an independent oracle. The ComplianceEscrow contract reads the TRUE breach count and settles automatically — faking the log is impossible.",
      attestations: cheat, // the cheater tries again — and fails
      chain: cheatChain,
      settlement: settle({ mode: "on-chain", terms, attestations: cheat, chain: cheatChain }),
    },
  ];
}
