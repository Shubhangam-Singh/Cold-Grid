/**
 * ColdGrid domain types (RULE 1 — pure, no React/DOM here).
 *
 * The spoilage engine in spoilage.ts consumes a ProduceProfile and evolves a
 * Batch. All Arrhenius/EMA parameters live on the profile so the physics is
 * fully data-driven and unit-testable.
 */

export type ProduceId =
  | "tomato"
  | "banana"
  | "apple"
  | "leafyVeg"
  | "mango"
  | "milk"
  | "fish"
  | "paneer";

/**
 * Per-produce physics parameters.
 *
 * The Arrhenius core (eaBase, k0, shelfLifeHours) and the EMA thermal-memory
 * fields (lambda, thermalStressK, gamma) come from the validated table in
 * spec §5.3 and MUST NOT be altered (RULE 2). The H/G shape parameters and the
 * derating safety nets (fMin, eaMinFrac) are documented defaults (see
 * produce.ts) and are tunable.
 */
export interface ProduceProfile {
  id: ProduceId;
  label: string;

  // ── Arrhenius core (patented; values from §5.3) ───────────────────────────
  /** Activation energy in J/mol (the §5.3 kJ/mol value × 1000, per §5.1). */
  eaBase: number;
  /** Arrhenius pre-exponential. Cancels in the baseRate ratio; kept for traceability. */
  k0: number;
  /** Shelf life in hours at reference conditions (25 °C, RH=rhRef, VOC=vocRef). */
  shelfLifeHours: number;

  // ── EMA thermal-memory (the patent core) ──────────────────────────────────
  /** EMA memory-retention factor in [0,1). HIGHER λ ⇒ more thermal inertia (slower response). */
  lambda: number;
  /** Temperature (K) above which thermal stress u_t accrues. */
  thermalStressK: number;
  /** Strength with which EMA derates F (and thus Ea_eff). Small by design — see produce.ts. */
  gamma: number;
  /** Hard floor on the derating factor F (safety net). */
  fMin: number;
  /** Hard floor on Ea_eff as a fraction of eaBase (safety net). */
  eaMinFrac: number;

  // ── Humidity POST-multiplier H(RH) — step 6 (NEVER inside the exponent) ────
  betaRate: number;
  rhRef: number;
  sRh: number;

  // ── Gas/VOC POST-multiplier G(VOC) — step 7 (NEVER inside the exponent) ────
  alphaRate: number;
  vocRef: number;
  sVoc: number;
}

/** One sampled point of a batch's degradation history (drives the decay-curve viewer). */
export interface BatchHistoryPoint {
  ageHours: number;
  quality: number;
  /** Ambient temperature (°C) at this tick. */
  T_C: number;
  /** EMA thermal-memory state at this tick. */
  ema: number;
}

/**
 * The evolving state of one shipment/batch of a single produce.
 * Evolved purely by stepBatch — see spoilage.ts.
 */
export interface Batch {
  id: string;
  produce: ProduceId;
  /** EMA thermal-memory state (starts 0). */
  ema: number;
  /** Remaining quality, 0–100 (starts 100). */
  quality: number;
  /** Accumulated fractional degradation (starts 0; quality = (1 − this) × 100). */
  cumulativeDeg: number;
  /** Number of ticks spent above the produce's thermal-stress threshold. */
  breachTicks: number;
  /** Total simulated hours elapsed for this batch. */
  ageHours: number;
  /** Per-tick history for charts/explainers. */
  history: BatchHistoryPoint[];
}
