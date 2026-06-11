/**
 * Operator scoring (spec §7.3). PURE.
 *
 * The composite is a value-weighted blend of food saved, on-time delivery, and
 * carbon efficiency, with a hard penalty for exceeding a scenario's energy
 * (generator) budget. Stars come from the scenario's tuned targets; the overall
 * certification level comes from total stars across all five scenarios.
 */

import type { Scenario } from "./types";
import type { DeliveryResult } from "./run";

// Cost & emissions factors (rough Indian commercial values; documented, tunable).
export const COST_PER_KWH = 8; // ₹ per kWh of reefer compressor energy
export const COST_PER_KM = 12; // ₹ per km of truck travel
export const CO2_PER_KWH = 0.71; // kg CO₂ per kWh (Indian grid average)
export const CO2_PER_KM = 0.25; // kg CO₂ per km (diesel reefer truck)

// Composite weights and shaping.
const W_FOOD = 0.55;
const W_ONTIME = 0.2;
const W_EFFICIENCY = 0.25;
const CO2_SCORE_SCALE = 2.2; // higher CO₂ ⇒ lower efficiency score
const OVER_BUDGET_PENALTY_PER_KWH = 6;
const MAX_OVER_BUDGET_PENALTY = 45;

export type Stars = 1 | 2 | 3;

export interface ScenarioScore {
  foodSavedPct: number;
  onTimePct: number;
  energyKwh: number;
  energyBudgetKwh: number;
  overBudget: boolean;
  costRupees: number;
  co2Kg: number;
  composite: number;
  stars: Stars;
  breakdown: { food: number; onTime: number; efficiency: number; budgetPenalty: number };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

export function scoreScenario(scenario: Scenario, results: DeliveryResult[]): ScenarioScore {
  const totalValue = results.reduce((s, r) => s + r.delivery.valueWeight, 0) || 1;

  const foodSavedPct =
    results.reduce((s, r) => s + r.qualityPct * r.delivery.valueWeight, 0) / totalValue;
  const onTimePct =
    results.reduce((s, r) => s + (r.onTime ? 100 : 0) * r.delivery.valueWeight, 0) / totalValue;

  const energyKwh = results.reduce((s, r) => s + r.energyKwh, 0);
  const distanceKm = results.reduce((s, r) => s + r.distanceKm, 0);
  const costRupees = energyKwh * COST_PER_KWH + distanceKm * COST_PER_KM;
  const co2Kg = energyKwh * CO2_PER_KWH + distanceKm * CO2_PER_KM;

  const efficiency = clamp(100 - co2Kg * CO2_SCORE_SCALE, 0, 100);

  const overBy = Math.max(0, energyKwh - scenario.energyBudgetKwh);
  const overBudget = overBy > 1e-9;
  const budgetPenalty = Math.min(MAX_OVER_BUDGET_PENALTY, overBy * OVER_BUDGET_PENALTY_PER_KWH);

  const food = W_FOOD * foodSavedPct;
  const onTime = W_ONTIME * onTimePct;
  const eff = W_EFFICIENCY * efficiency;
  const composite = clamp(food + onTime + eff - budgetPenalty, 0, 100);

  const stars: Stars =
    composite >= scenario.targets.threeStar ? 3 : composite >= scenario.targets.twoStar ? 2 : 1;

  return {
    foodSavedPct,
    onTimePct,
    energyKwh,
    energyBudgetKwh: scenario.energyBudgetKwh,
    overBudget,
    costRupees,
    co2Kg,
    composite,
    stars,
    breakdown: { food, onTime, efficiency: eff, budgetPenalty },
  };
}

export interface Certification {
  level: string;
  blurb: string;
  totalStars: number;
  maxStars: number;
  pct: number;
}

/**
 * Overall certification from the stars earned across completed scenarios.
 * maxStars = 3 × number of scenarios attempted.
 */
export function certificationLevel(totalStars: number, scenarioCount: number): Certification {
  const maxStars = Math.max(1, scenarioCount * 3);
  const pct = (totalStars / maxStars) * 100;
  let level = "Trainee";
  let blurb = "Keep practicing — review the decay curves to see what spoiled and why.";
  if (pct >= 90) {
    level = "Chief Cold-Chain Officer";
    blurb = "Exceptional. You balanced food, energy and carbon across every crisis.";
  } else if (pct >= 70) {
    level = "Senior Cold-Chain Operator";
    blurb = "Strong command of the cold/energy tradeoff under pressure.";
  } else if (pct >= 45) {
    level = "Certified Cold-Chain Operator";
    blurb = "Solid fundamentals — tighten your triage and routing to level up.";
  }
  return { level, blurb, totalStars, maxStars, pct };
}
