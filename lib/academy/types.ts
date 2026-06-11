/**
 * Academy domain types (spec §7). PURE — no React/DOM.
 *
 * A Scenario sets the city environment (heat, floods) and a set of required
 * deliveries. The operator makes a DeliveryDecision per delivery (dispatch?
 * refrigerated truck? at what setpoint?), the simulation runs, and scoring.ts
 * turns the outcome into a 0–100 score, 1–3 stars, and a certification level.
 */

import type { ProduceId } from "../engine/types";

export interface RequiredDelivery {
  id: string;
  label: string;
  produce: ProduceId;
  fromId: string;
  toId: string;
  /** Relative importance (units / rupees) used to value-weight the score. */
  valueWeight: number;
  /** Max acceptable transit time (h) for on-time credit; omit for no deadline. */
  deadlineHours?: number;
}

export interface ScenarioTargets {
  /** Composite ≥ this ⇒ 2 stars (a pass). */
  twoStar: number;
  /** Composite ≥ this ⇒ 3 stars. */
  threeStar: number;
}

export interface Scenario {
  id: string;
  index: number; // 1..5
  title: string;
  subtitle: string;
  briefing: string[];
  learningObjective: string;

  // ── Environment ───────────────────────────────────────────────────────────
  /** Ambient override °C (heatwave +, monsoon −). */
  scenarioOffsetC: number;
  /** Roads closed (flood). Routing avoids these. */
  closedEdgeIds: string[];
  startHourOfDay: number;
  /** Reefer compressor energy budget (kWh). Infinity = unconstrained; outage = tight. */
  energyBudgetKwh: number;

  requiredDeliveries: RequiredDelivery[];
  targets: ScenarioTargets;
  hints: string[];
  /** Concepts this scenario teaches (shown in debrief / tied to assessment in P6). */
  conceptTags: string[];
}

export interface DeliveryDecision {
  deliveryId: string;
  dispatched: boolean;
  reefer: boolean;
  setpointC: number;
}
