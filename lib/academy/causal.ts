/**
 * Causal-chain trace (pure): turns a delivery outcome into the four-step story
 * of WHY it happened, traced back to the operator's decision —
 *
 *   YOUR DECISION → TEMPERATURE EFFECT → CUMULATIVE DAMAGE → OUTCOME
 *
 * Every number is derived from the same patented spoilage engine the simulation
 * runs, so the explanation is the model's actual reasoning, not a narration.
 */

import type { BatchHistoryPoint, ProduceId } from "../engine/types";
import { getProduce } from "../engine/produce";
import { KELVIN, baseRate, celsiusToKelvin, thermalDerating } from "../engine/spoilage";

/** A "kept properly cold" reference temperature to compare the journey against. */
export const COLD_REFERENCE_C = 4;
/** Freshness floor: below this a load is no longer market-acceptable. */
export const FRESHNESS_THRESHOLD = 50;

export interface CausalChain {
  produceLabel: string;
  // 1 · decision
  reefer: boolean;
  setpointC: number | null; // null = ambient (unrefrigerated) truck
  // 2 · temperature effect
  peakTempC: number;
  avgTempC: number;
  safeCeilingC: number; // produce's safe holding ceiling (thermal-stress point)
  rateMultiplier: number; // Arrhenius rate at peak vs a 4 °C cold chain
  breached: boolean; // did cargo temp exceed the safe ceiling?
  // 3 · cumulative damage
  breachHour: number | null; // first hour the safe ceiling (or freshness line) was crossed
  qualityAtBreach: number | null;
  // 4 · outcome
  finalQuality: number;
  spoiled: boolean;
  belowFreshness: boolean;
  freshnessThreshold: number;
}

/** Dimensionless Arrhenius spoilage rate for produce held steady at a temp. */
export function arrheniusRateAt(produce: ProduceId, tempC: number): number {
  const p = getProduce(produce);
  const T_K = celsiusToKelvin(tempC);
  const steadyEma = Math.max(0, (T_K - p.thermalStressK) / 10); // EMA → u_t at constant T
  const { EaEff } = thermalDerating(steadyEma, p);
  return baseRate(T_K, EaEff, p);
}

export function buildCausalChain(args: {
  produce: ProduceId;
  reefer: boolean;
  setpointC: number | null;
  history: BatchHistoryPoint[];
  finalQuality: number;
  spoiled: boolean;
}): CausalChain {
  const p = getProduce(args.produce);
  const safeCeilingC = p.thermalStressK - KELVIN;
  const temps = args.history.map((h) => h.T_C);
  const peakTempC = temps.length ? Math.max(...temps) : safeCeilingC;
  const avgTempC = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : safeCeilingC;

  const coldRate = arrheniusRateAt(args.produce, COLD_REFERENCE_C);
  const rateMultiplier = coldRate > 0 ? arrheniusRateAt(args.produce, peakTempC) / coldRate : 1;

  // The pivotal moment: cargo temp first exceeds the safe ceiling; failing that,
  // quality first crosses the freshness floor.
  const tempBreach = args.history.find((h) => h.T_C > safeCeilingC + 1e-9) ?? null;
  const qualityBreach = args.history.find((h) => h.quality <= FRESHNESS_THRESHOLD) ?? null;
  const breach = tempBreach ?? qualityBreach;

  return {
    produceLabel: p.label,
    reefer: args.reefer,
    setpointC: args.setpointC,
    peakTempC,
    avgTempC,
    safeCeilingC,
    rateMultiplier,
    breached: tempBreach != null,
    breachHour: breach ? breach.ageHours : null,
    qualityAtBreach: breach ? breach.quality : null,
    finalQuality: args.finalQuality,
    spoiled: args.spoiled,
    belowFreshness: args.finalQuality < FRESHNESS_THRESHOLD,
    freshnessThreshold: FRESHNESS_THRESHOLD,
  };
}
