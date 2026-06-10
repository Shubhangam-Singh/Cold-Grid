/**
 * The validated produce database (spec §5.3).
 *
 * RULE 2 — patent integrity: the Ea, shelf-life, λ, and Tstress values below are
 * peer-reviewed and ±15% validated. DO NOT change them. If a new value is ever
 * needed it requires an Arrhenius derivation + literature citation — flag it,
 * never guess.
 *
 * §5.1 units guard: the table states Ea in kJ/mol; the Arrhenius formula needs
 * J/mol, so we multiply by 1000 here, in ONE place, and the units-guard test
 * (spoilage.test.ts) pins the resulting baseRate to a hand-computed value.
 */

import type { ProduceId, ProduceProfile } from "./types";

/** kJ/mol → J/mol. */
const KJ_TO_J = 1000;

/**
 * Shared shape-parameter defaults.
 *
 * These are NOT the patented per-produce Arrhenius values — they are the
 * derating safety nets and the H/G post-multiplier shape. They are uniform
 * across produce for now and fully tunable; each is documented with its
 * rationale and flagged in the Phase 1 report.
 */
const SHAPE_DEFAULTS = {
  /**
   * Nominal Arrhenius pre-exponential. It CANCELS exactly in the baseRate
   * ratio k_now/k_ref, so its value does not affect any engine output; kept
   * only for traceability to the PPSC firmware's Arrhenius form.
   */
  k0: 1e12,

  /**
   * EMA → Ea derating strength. Deliberately SMALL. Ea_eff sits inside the
   * Arrhenius exponent, where a fractional change in Ea is amplified by
   * ≈ Ea/(R·T) ≈ 30–45×. A large gamma would let thermal memory collapse the
   * rate by orders of magnitude — the same class of runaway-rate failure
   * RULE 2 warns about (the 5264× bug). At gamma = 0.03, a sustained ~10 °C
   * over-stress (EMA ≈ 1) raises the rate ~2–4× depending on produce — a
   * meaningful, bounded thermal-memory penalty.
   */
  gamma: 0.03,

  /** Hard floor on F. Not reached in realistic EMA ranges; a pathological-input safety net. */
  fMin: 0.5,
  /** Hard floor on Ea_eff as a fraction of eaBase (safety net, mirrors fMin). */
  eaMinFrac: 0.5,

  /** Humidity sensitivity. H saturates near 1.4 at 100 %RH. */
  betaRate: 0.4,
  /** %RH reference; H = 1 at or below this. Chennai-typical humid baseline. */
  rhRef: 80,
  /** %RH scale; RH = 100 ⇒ (100 − 80)/20 = 1.0. */
  sRh: 20,

  /** VOC/ethylene sensitivity. G saturates at 1.5 (tanh → 1). */
  alphaRate: 0.5,
  /** VOC baseline in sensor units (MQ-135-like); G = 1 at or below. */
  vocRef: 50,
  /** VOC scale. */
  sVoc: 50,
} as const;

/** Build a full ProduceProfile from the patented §5.3 values + shared shape defaults. */
function profile(p: {
  id: ProduceId;
  label: string;
  /** Activation energy in kJ/mol exactly as printed in §5.3. */
  eaKJ: number;
  shelfLifeHours: number;
  lambda: number;
  thermalStressK: number;
}): ProduceProfile {
  return {
    id: p.id,
    label: p.label,
    eaBase: p.eaKJ * KJ_TO_J,
    shelfLifeHours: p.shelfLifeHours,
    lambda: p.lambda,
    thermalStressK: p.thermalStressK,
    ...SHAPE_DEFAULTS,
  };
}

/**
 * The eight validated produce profiles (§5.3). Shelf lives converted to hours:
 * Tomato 3.75 d = 90 h · Banana 5 d = 120 h · Apple 7 d = 168 h ·
 * LeafyVeg 2 d = 48 h · Mango 4 d = 96 h · Milk 5.5 h · Fish 17.4 h · Paneer 24 h.
 */
export const PRODUCE: Record<ProduceId, ProduceProfile> = {
  // Kale & Nath 2018
  tomato: profile({ id: "tomato", label: "Tomato", eaKJ: 109.7, shelfLifeHours: 90, lambda: 0.93, thermalStressK: 303.15 }),
  // Dalavi 2025
  banana: profile({ id: "banana", label: "Banana", eaKJ: 60.9, shelfLifeHours: 120, lambda: 0.91, thermalStressK: 301.15 }),
  // Hertog 2014
  apple: profile({ id: "apple", label: "Apple", eaKJ: 90.0, shelfLifeHours: 168, lambda: 0.94, thermalStressK: 301.15 }),
  // FSSAI/ICMR
  leafyVeg: profile({ id: "leafyVeg", label: "Leafy Veg", eaKJ: 44.5, shelfLifeHours: 48, lambda: 0.88, thermalStressK: 298.15 }),
  // Chulalongkorn U. 2019
  mango: profile({ id: "mango", label: "Mango", eaKJ: 50.0, shelfLifeHours: 96, lambda: 0.92, thermalStressK: 303.15 }),
  // Zwietering 1991
  milk: profile({ id: "milk", label: "Milk", eaKJ: 90.0, shelfLifeHours: 5.5, lambda: 0.92, thermalStressK: 298.15 }),
  // Disney 1969 / ICAR
  fish: profile({ id: "fish", label: "Fish", eaKJ: 82.9, shelfLifeHours: 17.4, lambda: 0.87, thermalStressK: 298.15 }),
  // Raju & Sasikala 2016
  paneer: profile({ id: "paneer", label: "Paneer", eaKJ: 52.8, shelfLifeHours: 24, lambda: 0.91, thermalStressK: 298.15 }),
};

/** All produce ids in declaration order. */
export const PRODUCE_IDS = Object.keys(PRODUCE) as ProduceId[];

/** Look up a produce profile by id. */
export function getProduce(id: ProduceId): ProduceProfile {
  return PRODUCE[id];
}
