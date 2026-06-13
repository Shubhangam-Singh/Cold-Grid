/**
 * The simulated, hash-linked ledger (Phase 9, always-on default). PURE: every
 * function returns new state and never mutates its input.
 *
 * Each block hashes (index, timestamp, attestation, prevHash). Altering any
 * past block's content changes its hash, breaking the link to every later
 * block — which verifyChain() detects. That tamper-evidence is the whole point.
 */

import { chainHash } from "./hash";
import type { LedgerBlock, TempAttestation } from "./types";

export const GENESIS_PREV = "0x0";

function blockPayload(b: Omit<LedgerBlock, "hash">): string {
  return JSON.stringify({
    index: b.index,
    timestamp: b.timestamp,
    attestation: b.attestation,
    prevHash: b.prevHash,
  });
}

export function hashBlock(b: Omit<LedgerBlock, "hash">): string {
  return chainHash(blockPayload(b));
}

/** Append an attestation as a new hash-linked block. Pure. */
export function appendAttestation(
  chain: LedgerBlock[],
  attestation: TempAttestation
): LedgerBlock[] {
  const index = chain.length;
  const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : GENESIS_PREV;
  const partial = { index, timestamp: index, attestation, prevHash };
  return [...chain, { ...partial, hash: hashBlock(partial) }];
}

/** Build a full chain from an ordered attestation trace. */
export function buildChain(attestations: TempAttestation[]): LedgerBlock[] {
  return attestations.reduce<LedgerBlock[]>(
    (chain, a) => appendAttestation(chain, a),
    []
  );
}

export interface ChainVerification {
  intact: boolean;
  /** First block where the chain breaks, or null if intact. */
  brokenAtIndex: number | null;
  reason: string;
}

/** Verify the hash chain end-to-end — detects any tampering with a past block. */
export function verifyChain(chain: LedgerBlock[]): ChainVerification {
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    const expectedPrev = i === 0 ? GENESIS_PREV : chain[i - 1].hash;
    if (b.prevHash !== expectedPrev) {
      return { intact: false, brokenAtIndex: i, reason: `Block ${i}: broken link to previous block.` };
    }
    const recomputed = hashBlock({
      index: b.index,
      timestamp: b.timestamp,
      attestation: b.attestation,
      prevHash: b.prevHash,
    });
    if (recomputed !== b.hash) {
      return { intact: false, brokenAtIndex: i, reason: `Block ${i}: contents were altered after sealing.` };
    }
  }
  return { intact: true, brokenAtIndex: null, reason: "Chain intact — every block verifies." };
}

/**
 * Tamper helper for the teaching demo: rewrite a sealed block's reported
 * temperature WITHOUT re-hashing (as a fraudster would try). verifyChain() then
 * flags it. Pure.
 */
export function tamperReportedTemp(
  chain: LedgerBlock[],
  index: number,
  newReportedTempC: number
): LedgerBlock[] {
  return chain.map((b, i) =>
    i === index
      ? { ...b, attestation: { ...b.attestation, reportedTempC: newReportedTempC } }
      : b
  );
}
