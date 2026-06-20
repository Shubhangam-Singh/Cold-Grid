/**
 * Phase 9 improvement — translate an escrow settlement into human stakes.
 *
 * A withheld penalty or a fraud loss isn't just rupees: it's food and meals
 * that either get protected (on-chain enforcement) or get passed off as fresh
 * and land on a vendor's thin margin (off-chain fraud). Pure & deterministic.
 */

import type { ProduceId } from "../engine/types";
import type { Settlement } from "./types";

/** Illustrative Chennai wholesale prices (₹/kg) — for translating ₹ → food. */
const PRICE_PER_KG: Record<ProduceId, number> = {
  fish: 250,
  milk: 60,
  paneer: 350,
  leafyVeg: 40,
  tomato: 30,
  banana: 50,
  apple: 180,
  mango: 90,
};

const KG_PER_MEAL = 0.25;

export interface SettlementImpact {
  /** The rupee figure at stake in this settlement. */
  rupees: number;
  /** Kilograms of this produce that figure represents. */
  cargoKg: number;
  /** Approximate meals that food represents (~0.25 kg/meal). */
  meals: number;
  /** A one-line, human-readable equity note (empty when nothing is at stake). */
  note: string;
}

export function settlementImpact(s: Settlement, produce: ProduceId): SettlementImpact {
  const price = PRICE_PER_KG[produce] ?? 100;

  // On-chain enforcement PROTECTS the withheld penalty; off-chain fraud LOSES
  // the full (over-)payment for goods that actually spoiled.
  const rupees =
    s.mode === "on-chain" ? s.withheldRupees : s.fraudDetected ? s.payoutRupees : 0;
  const cargoKg = rupees / price;
  const meals = Math.round(cargoKg / KG_PER_MEAL);

  let note = "";
  if (rupees > 0 && s.mode === "on-chain") {
    note = `Settling on the truth keeps ₹${rupees.toLocaleString("en-IN")} from rewarding spoiled cargo — about ${meals.toLocaleString("en-IN")} meals' worth that won't be passed off as fresh.`;
  } else if (rupees > 0 && s.fraudDetected) {
    note = `The faked log just cost the buyer ₹${rupees.toLocaleString("en-IN")} for cargo that spoiled — about ${meals.toLocaleString("en-IN")} meals lost, and downstream that loss is a vendor's margin or a family's food.`;
  }

  return { rupees, cargoKg, meals, note };
}
