/**
 * The patented spoilage engine — PPSC v22 Adaptive Arrhenius + EMA model
 * (spec §5). PURE TypeScript: no React, no DOM (RULE 1).
 *
 * The 8 steps (per tick, per batch):
 *   1. u_t      = max(0, (T_K − thermalStressK) / 10)
 *   2. EMA      = λ·EMA + (1 − λ)·u_t                     ← PATENT CORE (thermal memory)
 *   3. F        = max(fMin, 1 − γ·EMA)
 *   4. Ea_eff   = clamp(F·Ea_base, eaMinFrac·Ea_base, Ea_base)
 *   5. baseRate = k_now/k_ref,  k_now = k0·exp(−Ea_eff/(R·T_K))
 *   6. H        = 1 + βrate·max(0, (RH − rhRef)/sRh)       ← POST-multiplier
 *   7. G        = 1 + αrate·max(0, tanh((VOC − vocRef)/sVoc)) ← POST-multiplier
 *   8. rate     = baseRate · H · G                         ← H,G OUTSIDE the exponent
 *
 * RULE 2: only F (from EMA) modulates Ea_eff INSIDE the Arrhenius exponent.
 * H and G are applied AFTER the exponent at step 8. They must NEVER be moved
 * inside it (doing so caused the historical 5264× rate-amplification bug).
 */

import type { Batch, BatchHistoryPoint, ProduceId, ProduceProfile } from "./types";

/** Universal gas constant, J/(mol·K). */
export const R = 8.314;
/** °C → K offset. */
export const KELVIN = 273.15;
/** Reference temperature for the rate ratio: 25 °C. */
export const T_REF_K = 298.15;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/** °C → K. */
export function celsiusToKelvin(tC: number): number {
  return tC + KELVIN;
}

/**
 * Steps 1–2: advance the EMA thermal-memory state by one tick.
 * u_t is the instantaneous thermal stress; EMA smooths it with retention λ.
 */
export function emaUpdate(emaPrev: number, T_K: number, p: ProduceProfile): number {
  const u_t = Math.max(0, (T_K - p.thermalStressK) / 10); // step 1
  return p.lambda * emaPrev + (1 - p.lambda) * u_t; // step 2  ← PATENT CORE
}

/**
 * Steps 3–4: the EMA-derived derating factor F and the adaptive activation
 * energy Ea_eff. Thermal memory lowers F, which lowers Ea_eff, which (at step 5)
 * raises the rate — the patent's cumulative thermal-damage effect.
 */
export function thermalDerating(
  ema: number,
  p: ProduceProfile
): { F: number; EaEff: number } {
  const F = Math.max(p.fMin, 1 - p.gamma * ema); // step 3
  const EaEff = clamp(F * p.eaBase, p.eaMinFrac * p.eaBase, p.eaBase); // step 4
  return { F, EaEff };
}

/**
 * Step 5: the dimensionless base degradation rate relative to reference
 * conditions, baseRate = k_now/k_ref.
 *
 * k_now = k0·exp(−Ea_eff/(R·T_K)),  k_ref = k0·exp(−Ea_base/(R·T_REF_K)).
 * k0 cancels exactly, so we evaluate the ratio in closed form — numerically
 * identical and immune to under/overflow of the individual exponentials.
 */
export function baseRate(T_K: number, EaEff: number, p: ProduceProfile): number {
  return Math.exp((p.eaBase / T_REF_K - EaEff / T_K) / R);
}

/**
 * Step 6: humidity POST-multiplier H(RH) ≥ 1. H = 1 at or below rhRef; rises
 * with excess humidity. NEVER moved inside the Arrhenius exponent (RULE 2).
 */
export function humidityMultiplier(RH: number, p: ProduceProfile): number {
  return 1 + p.betaRate * Math.max(0, (RH - p.rhRef) / p.sRh);
}

/**
 * Step 7: gas/VOC POST-multiplier G(VOC) ≥ 1, saturating via tanh. G = 1 at or
 * below vocRef. NEVER moved inside the Arrhenius exponent (RULE 2).
 */
export function gasMultiplier(VOC: number, p: ProduceProfile): number {
  return 1 + p.alphaRate * Math.max(0, Math.tanh((VOC - p.vocRef) / p.sVoc));
}

/**
 * The full 8-step update. PURE: returns a NEW Batch and never mutates its
 * input (or the input's history array).
 */
export function stepBatch(
  batch: Batch,
  p: ProduceProfile,
  T_C: number,
  RH: number,
  VOC: number,
  dtHours: number
): Batch {
  const T_K = celsiusToKelvin(T_C);

  const ema = emaUpdate(batch.ema, T_K, p); // 1–2
  const { EaEff } = thermalDerating(ema, p); // 3–4
  const br = baseRate(T_K, EaEff, p); // 5
  const H = humidityMultiplier(RH, p); // 6
  const G = gasMultiplier(VOC, p); // 7
  const degradationRate = br * H * G; // 8  ← H,G OUTSIDE the exponent

  const cumulativeDeg =
    batch.cumulativeDeg + (degradationRate * dtHours) / p.shelfLifeHours;
  const quality = clamp((1 - cumulativeDeg) * 100, 0, 100);
  const ageHours = batch.ageHours + dtHours;
  const breachTicks = batch.breachTicks + (T_K > p.thermalStressK ? 1 : 0);

  const point: BatchHistoryPoint = { ageHours, quality, T_C, ema };

  return {
    ...batch,
    ema,
    cumulativeDeg,
    quality,
    ageHours,
    breachTicks,
    history: [...batch.history, point],
  };
}

/** A fresh, full-quality batch of the given produce. */
export function createBatch(id: string, produce: ProduceId): Batch {
  return {
    id,
    produce,
    ema: 0,
    quality: 100,
    cumulativeDeg: 0,
    breachTicks: 0,
    ageHours: 0,
    history: [],
  };
}

/**
 * Whether a batch has spoiled: its cumulative degradation has consumed the
 * full shelf life of this produce (equivalently, quality has clamped to 0).
 */
export function isSpoiled(batch: Batch, p: ProduceProfile): boolean {
  return batch.cumulativeDeg >= 1 || p.shelfLifeHours <= 0;
}

/**
 * Predicted remaining shelf life (hours) if the batch were held at a constant
 * assumedT_C from now on, at reference humidity/gas (H = G = 1).
 *
 * Uses the steady-state EMA at that temperature (EMA → u_t under constant T),
 * so this answers "if I park it at this temperature, how long until quality 0?"
 */
export function predictedShelfLifeHours(
  batch: Batch,
  p: ProduceProfile,
  assumedT_C: number
): number {
  if (batch.cumulativeDeg >= 1) return 0;

  const T_K = celsiusToKelvin(assumedT_C);
  const steadyEma = Math.max(0, (T_K - p.thermalStressK) / 10); // EMA → u_t at constant T
  const { EaEff } = thermalDerating(steadyEma, p);
  const rate = baseRate(T_K, EaEff, p);
  if (rate <= 0) return Infinity;

  const remainingFrac = 1 - batch.cumulativeDeg;
  return (remainingFrac * p.shelfLifeHours) / rate;
}
