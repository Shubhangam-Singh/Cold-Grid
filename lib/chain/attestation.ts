/**
 * ColdChainAttestation (simulated). Role-gated temperature attestation — mirrors
 * the OpenZeppelin AccessControl roles in contracts/ColdChainAttestation.sol.
 *
 * Only the `transporter` role may post temperature readings. Each attestation
 * carries BOTH the reported value (what a self-reported log would show) and the
 * oracle's true value, so the escrow can contrast trust models.
 */

import type { BatchHistoryPoint, ProduceId } from "../engine/types";
import { KELVIN } from "../engine/spoilage";
import { getProduce } from "../engine/produce";
import type { ChainRole, TempAttestation } from "./types";

/** The only role authorized to post temperature attestations. */
export const ATTESTER_ROLE: ChainRole = "transporter";

export class RoleError extends Error {
  constructor(role: ChainRole) {
    super(`AccessControl: role '${role}' is not authorized to attest temperatures (needs '${ATTESTER_ROLE}').`);
    this.name = "RoleError";
  }
}

/** Cold-chain breach threshold (°C) for a produce — its thermal-stress point. */
export function breachThresholdC(produce: ProduceId): number {
  return getProduce(produce).thermalStressK - KELVIN;
}

/**
 * Build a temperature attestation trace from a batch's TRUE history (the oracle).
 * `cheat` makes the transporter under-report: every reading is clamped to look
 * safely below the threshold, hiding real breaches.
 */
export function buildAttestations(opts: {
  shipmentId: string;
  produce: ProduceId;
  history: BatchHistoryPoint[];
  postedBy: ChainRole;
  cheat?: boolean;
  /** Downsample the per-tick history (1 = every tick). */
  sampleEvery?: number;
}): TempAttestation[] {
  if (opts.postedBy !== ATTESTER_ROLE) throw new RoleError(opts.postedBy);

  const thresholdC = breachThresholdC(opts.produce);
  const step = Math.max(1, Math.floor(opts.sampleEvery ?? 1));
  const out: TempAttestation[] = [];
  let seq = 0;

  for (let i = 0; i < opts.history.length; i += step) {
    const trueTempC = opts.history[i].T_C;
    const reportedTempC = opts.cheat ? Math.min(trueTempC, thresholdC - 1) : trueTempC;
    out.push({
      shipmentId: opts.shipmentId,
      seq: seq++,
      reportedTempC,
      trueTempC,
      thresholdC,
      postedBy: opts.postedBy,
    });
  }
  return out;
}

/** Count breach readings using either the reported or the true temperature. */
export function countBreaches(attestations: TempAttestation[], useTruth: boolean): number {
  return attestations.filter(
    (a) => (useTruth ? a.trueTempC : a.reportedTempC) > a.thresholdC
  ).length;
}
