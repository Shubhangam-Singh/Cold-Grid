/**
 * Keep this identical to coldgrid/lib/hardware/attestPolicy.ts.
 * The poster cannot import that TypeScript module.
 */

export const ATTEST_INTERVAL_S = 60;
export const ATTEST_DELTA_C = 1;

export function emptyAttestCursor() {
  return { lastPostedAt: null, lastPostedTempC: null, wasBreach: false };
}

function isBreach(tempC, thresholdC) {
  return Math.round(tempC * 100) > Math.round(thresholdC * 100);
}

export function shouldAttest(cursor, sample, thresholdC) {
  const breach = isBreach(sample.tempC, thresholdC);
  const posted = {
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
