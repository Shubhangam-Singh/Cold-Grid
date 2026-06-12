/**
 * The five Chennai operator-training scenarios (spec §7.2). Each maps to the
 * Smart-Cities track's interest in public-safety infrastructure, emergency
 * response, and disaster-resilience planning.
 *
 * PURE data. Tuned so a sound operator plan earns 3 stars and a careless one
 * earns 1 — locked by scenarios.test.ts model-answer runs.
 */

import type { ProduceId } from "../engine/types";
import type { DeliveryDecision, Scenario } from "./types";

/** Produce that spoils fast and rewards refrigeration. */
export const FRAGILE: ProduceId[] = ["milk", "fish", "paneer", "leafyVeg"];
/** Produce hardy enough to tolerate an ambient truck on a short hop. */
export const HARDY: ProduceId[] = ["apple", "banana", "tomato", "mango"];

export const SCENARIOS: Scenario[] = [
  {
    id: "normal-day",
    index: 1,
    title: "Normal Day",
    subtitle: "Tutorial · learn the console",
    briefing: [
      "Welcome, duty officer. It's a calm morning in Chennai. The fishing fleet has just landed its catch at Kasimedu.",
      "Your job: get one fish shipment to the Mylapore market in good condition. Choose whether to send it in a refrigerated truck (a reefer) and at what setpoint, then run the day.",
    ],
    learningObjective:
      "Read the console, dispatch a shipment, pick a transport setpoint, and interpret the result.",
    scenarioOffsetC: 0,
    closedEdgeIds: [],
    startHourOfDay: 5,
    energyBudgetKwh: 30,
    requiredDeliveries: [
      { id: "d1", label: "Fish to Mylapore", produce: "fish", fromId: "kasimedu", toId: "mylapore", valueWeight: 1, deadlineHours: 4 },
    ],
    targets: { twoStar: 60, threeStar: 82 },
    hints: [
      "Fish is highly perishable — an ambient truck on a warm morning loses quality fast.",
      "A reefer near 2–4 °C keeps it fresh, but watch the energy it draws.",
    ],
    conceptTags: ["cold-chain", "arrhenius-q10"],
  },
  {
    id: "heatwave",
    index: 2,
    title: "The 40 °C Heatwave",
    subtitle: "Cold vs energy vs CO₂ under stress",
    briefing: [
      "A brutal heatwave has pushed the city well past 40 °C. Dairy and leafy-vegetable shipments are at risk across the network.",
      "Refrigeration will save the cargo — but the hotter it is outside, the harder the compressors work, and the more energy and CO₂ you burn. Find the balance.",
    ],
    learningObjective:
      "Manage the cold / energy / CO₂ tradeoff when ambient temperature is extreme.",
    scenarioOffsetC: 8,
    closedEdgeIds: [],
    startHourOfDay: 12,
    energyBudgetKwh: 45,
    requiredDeliveries: [
      { id: "d1", label: "Milk to Adyar", produce: "milk", fromId: "aavin-madhavaram", toId: "adyar", valueWeight: 2, deadlineHours: 5 },
      { id: "d2", label: "Milk to Velachery", produce: "milk", fromId: "aavin-madhavaram", toId: "velachery", valueWeight: 2, deadlineHours: 6 },
      { id: "d3", label: "Leafy veg to T. Nagar", produce: "leafyVeg", fromId: "koyambedu", toId: "t-nagar", valueWeight: 1, deadlineHours: 4 },
    ],
    targets: { twoStar: 60, threeStar: 82 },
    hints: [
      "At 40 °C+, an ambient truck will spoil dairy before it arrives.",
      "Very cold setpoints save food but spend energy fast — don't over-cool beyond what the cargo needs.",
    ],
    conceptTags: ["arrhenius-q10", "food-mile-co2", "cold-chain"],
  },
  {
    id: "grid-outage",
    index: 3,
    title: "Grid Outage",
    subtitle: "Triage under a fuel-limited generator",
    briefing: [
      "A substation has failed. Refrigeration now runs only on backup generation, and your fuel is strictly limited.",
      "You cannot refrigerate everything. Decide which stock to protect: spend your scarce generator energy on the perishables that will spoil without it, and let the hardy produce travel ambient.",
    ],
    learningObjective:
      "Triage and prioritize a scarce cold resource across mixed-fragility stock.",
    scenarioOffsetC: 3,
    closedEdgeIds: [],
    startHourOfDay: 13,
    energyBudgetKwh: 3.5,
    requiredDeliveries: [
      { id: "d1", label: "Fish to Mylapore", produce: "fish", fromId: "kasimedu", toId: "mylapore", valueWeight: 2, deadlineHours: 4 },
      { id: "d2", label: "Paneer to Adyar", produce: "paneer", fromId: "aavin-madhavaram", toId: "adyar", valueWeight: 2, deadlineHours: 5 },
      { id: "d3", label: "Banana to Anna Nagar", produce: "banana", fromId: "koyambedu", toId: "anna-nagar", valueWeight: 1, deadlineHours: 5 },
      { id: "d4", label: "Apple to T. Nagar", produce: "apple", fromId: "koyambedu", toId: "t-nagar", valueWeight: 1, deadlineHours: 6 },
    ],
    targets: { twoStar: 55, threeStar: 75 },
    hints: [
      "Your energy budget can't cool every truck — check the budget gauge.",
      "Fish and paneer spoil fast; apples and bananas tolerate an ambient run. Spend the generator where it matters.",
    ],
    conceptTags: ["cold-chain", "equity-waste", "thermal-inertia"],
  },
  {
    id: "monsoon",
    index: 4,
    title: "Monsoon Flooding",
    subtitle: "Resilience & rerouting under road closures",
    briefing: [
      "The northeast monsoon has flooded Chennai's low-lying roads. The fast main routes to Velachery, Adyar and along the coast are underwater and closed.",
      "Deliveries must take longer, warmer alternate roads. Plan around the closures and keep the cargo cold enough to survive the detour.",
    ],
    learningObjective:
      "Plan resilient routing when the fastest roads are cut, and compensate for longer transit.",
    scenarioOffsetC: -1,
    closedEdgeIds: ["guindy_velachery_main", "guindy_adyar_main", "kasimedu_mylapore_coastal"],
    startHourOfDay: 10,
    energyBudgetKwh: 40,
    requiredDeliveries: [
      { id: "d1", label: "Fish to Mylapore", produce: "fish", fromId: "kasimedu", toId: "mylapore", valueWeight: 2, deadlineHours: 5 },
      { id: "d2", label: "Milk to Velachery", produce: "milk", fromId: "aavin-madhavaram", toId: "velachery", valueWeight: 2, deadlineHours: 6 },
      { id: "d3", label: "Paneer to Adyar", produce: "paneer", fromId: "aavin-madhavaram", toId: "adyar", valueWeight: 1, deadlineHours: 6 },
    ],
    targets: { twoStar: 60, threeStar: 82 },
    hints: [
      "Flooded roads are closed automatically — routing finds the open alternate, which is longer.",
      "Longer transit means more time to spoil; a reefer buys back the margin the detour costs.",
    ],
    conceptTags: ["cold-chain", "thermal-inertia", "food-mile-co2"],
  },
  {
    id: "festival-surge",
    index: 5,
    title: "Festival Demand Surge",
    subtitle: "Pongal — throughput vs spoilage",
    briefing: [
      "It's Pongal. Demand across the city has doubled and every market wants stock at once. Supply is straining and the day is hot.",
      "Move a high volume of mixed produce while keeping spoilage down and energy under control. You can't gold-plate every shipment — spend the cold where the cargo is fragile.",
    ],
    learningObjective:
      "Balance high throughput against spoilage and energy when the network is saturated.",
    scenarioOffsetC: 4,
    closedEdgeIds: [],
    startHourOfDay: 11,
    energyBudgetKwh: 38,
    requiredDeliveries: [
      { id: "d1", label: "Milk to T. Nagar", produce: "milk", fromId: "aavin-madhavaram", toId: "t-nagar", valueWeight: 2, deadlineHours: 5 },
      { id: "d2", label: "Fish to Mylapore", produce: "fish", fromId: "kasimedu", toId: "mylapore", valueWeight: 2, deadlineHours: 4 },
      { id: "d3", label: "Paneer to Adyar", produce: "paneer", fromId: "aavin-madhavaram", toId: "adyar", valueWeight: 1, deadlineHours: 5 },
      { id: "d4", label: "Tomato to T. Nagar", produce: "tomato", fromId: "koyambedu", toId: "t-nagar", valueWeight: 1, deadlineHours: 6 },
      { id: "d5", label: "Mango to Anna Nagar", produce: "mango", fromId: "koyambedu", toId: "anna-nagar", valueWeight: 1, deadlineHours: 6 },
      { id: "d6", label: "Banana to Velachery", produce: "banana", fromId: "koyambedu", toId: "velachery", valueWeight: 1, deadlineHours: 7 },
    ],
    targets: { twoStar: 60, threeStar: 82 },
    hints: [
      "Six deliveries at once — prioritize cold for the dairy and fish.",
      "Hardy produce (tomato, mango, banana) can ride ambient to save energy for what needs it.",
    ],
    conceptTags: ["cold-chain", "food-mile-co2", "equity-waste"],
  },
];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}

import { DRIVERS } from "../engine/drivers";

/**
 * A sensible starting plan for a scenario's console: refrigerate the fragile
 * produce at a cold setpoint, send hardy produce ambient. Also a reasonable
 * baseline for tests. The operator can override any of it.
 */
export function suggestedDecisions(scenario: Scenario, setpointC = 3): DeliveryDecision[] {
  return scenario.requiredDeliveries.map((d, i) => ({
    deliveryId: d.id,
    dispatched: true,
    reefer: FRAGILE.includes(d.produce),
    setpointC,
    driverId: DRIVERS[i % DRIVERS.length].id,
    routeStrategy: "fastest",
  }));
}
