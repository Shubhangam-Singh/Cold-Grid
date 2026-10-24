/**
 * Deterministic detectors. Excursion and tamper are exact. Sensor faults
 * are flatlines and impossible jumps — no learned model.
 */

import { verifyChain, verifyOpenChain } from "./chainBridge";
import type { LedgerBlock } from "../chain/types";

export function detectExcursion(temps: number[], thresholdC: number): boolean {
  return temps.some((t) => Number.isFinite(t) && t > thresholdC);
}

export type FaultKind = "ok" | "flatline" | "jump";

export function detectFault(temps: number[]): FaultKind {
  const clean = temps.filter((t) => Number.isFinite(t));
  if (clean.length >= 6 && clean.every((t) => t === clean[0])) return "flatline";
  for (let i = 1; i < clean.length; i++) {
    if (Math.abs(clean[i] - clean[i - 1]) > 10) return "jump";
  }
  return "ok";
}

export function detectTamper(blocks: LedgerBlock[], kind: "open" | "genesis"): boolean {
  if (blocks.length === 0) return false;
  const verdict = kind === "genesis" ? verifyChain(blocks) : verifyOpenChain(blocks);
  return !verdict.intact;
}
