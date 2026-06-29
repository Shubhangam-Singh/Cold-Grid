/**
 * Citizen Mode (pure): the whole simulation, reduced to one choice — how much
 * you care about cost vs food safety — run on one representative vegetable
 * delivery across a hot Chennai afternoon. Same engine, same physics, one knob.
 */

import { simulateScenario } from "../academy/run";
import type { DeliveryDecision, Scenario } from "../academy/types";
import { DRIVERS } from "../engine/drivers";
import { CO2_PER_KM, CO2_PER_KWH, COST_PER_KM, COST_PER_KWH } from "../academy/scoring";

const CITIZEN_SCENARIO: Scenario = {
  id: "citizen",
  index: 0,
  title: "Citizen",
  subtitle: "",
  briefing: [],
  learningObjective: "",
  scenarioOffsetC: 8, // a scorching Chennai afternoon
  closedEdgeIds: [],
  startHourOfDay: 14,
  energyBudgetKwh: Infinity,
  requiredDeliveries: [
    {
      id: "v",
      // A long regional haul from Asia's largest wholesale market — hours in the
      // heat — so the cost-vs-cold choice actually decides whether it survives.
      label: "Vegetables to a town market",
      produce: "leafyVeg",
      fromId: "koyambedu",
      toId: "puducherry-main",
      valueWeight: 1,
      deadlineHours: 8,
    },
  ],
  targets: { twoStar: 60, threeStar: 82 },
  hints: [],
  conceptTags: [],
  crisisEnabled: false,
};

export interface CitizenOutcome {
  /** 0 = all about cost, 100 = all about food safety. */
  care: number;
  reefer: boolean;
  setpointC: number | null;
  qualityPct: number;
  spoiled: boolean;
  /** Total trip cost (₹) and CO₂ (kg). */
  costRupees: number;
  co2Kg: number;
  /** The part the choice actually changes: refrigeration energy cost / CO₂. */
  coolingCostRupees: number;
  coolingCo2Kg: number;
}

/** Map the single "care" slider (0–100) to an outcome via the real engine. */
export function citizenOutcome(care: number): CitizenOutcome {
  // Below 25 you skip refrigeration entirely (cheapest); above that you cool,
  // and the more you care the colder (10 °C → 2 °C) you hold it.
  const reefer = care >= 25;
  const setpointC = reefer ? Math.round(10 - ((care - 25) / 75) * 8) : null;

  const decision: DeliveryDecision = {
    deliveryId: "v",
    dispatched: true,
    reefer,
    setpointC: setpointC ?? 4,
    driverId: DRIVERS[0].id,
    routeStrategy: "fastest",
  };

  const r = simulateScenario(CITIZEN_SCENARIO, [decision]).results[0];
  const costRupees = r.energyKwh * COST_PER_KWH + r.distanceKm * COST_PER_KM;
  const co2Kg = r.energyKwh * CO2_PER_KWH + r.distanceKm * CO2_PER_KM;

  return {
    care,
    reefer,
    setpointC,
    qualityPct: r.qualityPct,
    spoiled: r.spoiled,
    costRupees,
    co2Kg,
    coolingCostRupees: r.energyKwh * COST_PER_KWH,
    coolingCo2Kg: r.energyKwh * CO2_PER_KWH,
  };
}
