/**
 * When a live cart sample is worth a Solidity transaction.
 * The browser ledger still seals every sample. The local chain posts only on
 * the first sample, a breach edge, a 1°C move, or 60 seconds since the last post.
 * Breach uses centi-°C, same comparison as ColdChainAttestation (`>`).
 */

export const ATTEST_INTERVAL_S = 60;
export const ATTEST_DELTA_C = 1;

export interface AttestCursor {
  lastPostedAt: number | null;
  lastPostedTempC: number | null;
  wasBreach: boolean;
}

export type AttestReason = "first" | "breach-edge" | "delta" | "interval" | "skip";

export function emptyAttestCursor(): AttestCursor {
  return { lastPostedAt: null, lastPostedTempC: null, wasBreach: false };
}

function isBreach(tempC: number, thresholdC: number): boolean {
  return Math.round(tempC * 100) > Math.round(thresholdC * 100);
}

export function shouldAttest(
  cursor: AttestCursor,
  sample: { tempC: number; at: number },
  thresholdC: number
): { post: boolean; reason: AttestReason; next: AttestCursor } {
  const breach = isBreach(sample.tempC, thresholdC);
  const posted: AttestCursor = {
    lastPostedAt: sample.at,
    lastPostedTempC: sample.tempC,
    wasBreach: breach,
  };
  if (cursor.lastPostedAt == null || cursor.lastPostedTempC == null) {
    return { post: true, reason: "first", next: posted };
  }
  if (breach !== cursor.wasBreach) return { post: true, reason: "breach-edge", next: posted };
  if (Math.abs(sample.tempC - cursor.lastPostedTempC) >= ATTEST_DELTA_C) {
    return { post: true, reason: "delta", next: posted };
  }
  if (sample.at - cursor.lastPostedAt >= ATTEST_INTERVAL_S) {
    return { post: true, reason: "interval", next: posted };
  }
  return { post: false, reason: "skip", next: cursor };
}
