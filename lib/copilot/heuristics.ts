/**
 * The free copilot (spec Phase 7, RULE 3 default). A PURE, deterministic
 * rules engine that gives genuinely useful, physics-grounded operator advice
 * with no API calls. This is ALWAYS available; the live Anthropic copilot
 * (flag-gated) only enriches the phrasing of the same facts.
 */

import {
  type CityEdge,
  edgeAmbientC,
  getEdge,
} from "../city/chennai";
import { predictedShelfLifeHours } from "../engine/spoilage";
import { getProduce } from "../engine/produce";
import type { Shipment, SimulationState } from "../engine/simulation";

export type Severity = "critical" | "warn" | "info";

export interface Advice {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface CopilotReport {
  summary: string;
  advice: Advice[];
  /** Number of in-transit shipments projected to spoil before arrival. */
  atRisk: number;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warn: 1, info: 2 };

/** Remaining travel time (hours) for an in-transit shipment. */
export function remainingTravelHours(s: Shipment): number {
  let hours = 0;
  for (let i = s.legIndex; i < s.route.length; i++) {
    const legHours = getEdge(s.route[i]).travelTimeMin / 60;
    hours += i === s.legIndex ? legHours * (1 - s.legProgress) : legHours;
  }
  return hours;
}

/** Route ambient °C the cargo is currently exposed to (before any reefer). */
function currentAmbientC(s: Shipment, state: SimulationState): number {
  const edge: CityEdge = getEdge(s.route[s.legIndex]);
  return edgeAmbientC(edge, state.hourOfDay, state.scenarioOffsetC);
}

/** Analyze the live fleet and produce prioritized advice (pure, deterministic). */
export function analyzeFleet(state: SimulationState): CopilotReport {
  const advice: Advice[] = [];
  const inTransit = state.shipments.filter((s) => s.status === "in-transit");
  let atRisk = 0;

  // ── City-level conditions ────────────────────────────────────────────────
  if (state.scenarioOffsetC >= 4) {
    advice.push({
      id: "city-heatwave",
      severity: "warn",
      title: `Heatwave active (+${state.scenarioOffsetC.toFixed(0)}°C)`,
      detail:
        "Ambient is far above safe storage. Dairy, fish and leafy veg will spoil in an open truck — send them in a reefer. Each ~10°C of heat roughly doubles–triples the spoilage rate (Q10).",
    });
  }
  if (state.closedEdgeIds.length > 0) {
    advice.push({
      id: "city-flood",
      severity: "info",
      title: "Roads closed (flooding)",
      detail:
        "Routing is taking longer, warmer alternates. Longer transit means more time to spoil — add cold margin with a colder setpoint.",
    });
  }

  // ── Per-shipment analysis ────────────────────────────────────────────────
  for (const s of inTransit) {
    const profile = getProduce(s.produce);
    const label = `${profile.label} ${s.id}`;
    const temp = s.lastTempC;
    const reefer = s.transportSetpointC != null;
    const remaining = remainingTravelHours(s);
    const predLife = predictedShelfLifeHours(s.batch, profile, temp);
    const ambient = currentAmbientC(s, state);

    if (s.batch.quality <= 0) {
      advice.push({
        id: `${s.id}-spoiled`,
        severity: "critical",
        title: `${label} has spoiled`,
        detail: `Quality is 0 — it's a loss. Pull it from the delivery plan and dispatch a replacement.`,
      });
      atRisk++;
      continue;
    }

    if (predLife < remaining) {
      atRisk++;
      const deficit = remaining - predLife;
      if (!reefer) {
        advice.push({
          id: `${s.id}-willspoil`,
          severity: "critical",
          title: `${label} won't make it`,
          detail: `At ${temp.toFixed(1)}°C it has ~${predLife.toFixed(
            1
          )} h of life but ~${remaining.toFixed(1)} h to go (${deficit.toFixed(
            1
          )} h short). Re-dispatch in a reefer at ≤4°C — cooling the cargo collapses the Arrhenius rate.`,
        });
      } else {
        advice.push({
          id: `${s.id}-willspoil`,
          severity: "critical",
          title: `${label} still short even chilled`,
          detail: `Reefer at ${s.transportSetpointC?.toFixed(
            0
          )}°C buys ~${predLife.toFixed(1)} h vs ~${remaining.toFixed(
            1
          )} h to go. Drop the setpoint toward 0–2°C, or take a shorter route — and note thermal memory means earlier heat is still costing it.`,
        });
      }
      continue;
    }

    if (predLife < remaining * 1.5) {
      advice.push({
        id: `${s.id}-tight`,
        severity: "warn",
        title: `${label} is tight`,
        detail: `~${predLife.toFixed(1)} h of life for ~${remaining.toFixed(
          1
        )} h of travel — little margin. ${
          reefer ? "Hold the cold setpoint." : "A reefer would buy back the margin."
        }`,
      });
      continue;
    }

    // Over-cooling: plenty of margin but burning compressor energy.
    if (reefer && s.transportSetpointC != null) {
      const lift = ambient - s.transportSetpointC;
      if (lift > 28 && predLife > remaining * 3) {
        advice.push({
          id: `${s.id}-overcool`,
          severity: "info",
          title: `${label} is over-cooled`,
          detail: `It has ~${predLife.toFixed(1)} h of life for only ~${remaining.toFixed(
            1
          )} h of travel. Raising the setpoint a few °C cuts compressor energy and CO₂ with no spoilage risk.`,
        });
      }
    }
  }

  advice.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const summary =
    inTransit.length === 0
      ? "No shipments in transit. Dispatch a load and press play to get live advice."
      : `${inTransit.length} in transit · ${atRisk} projected to spoil · ${advice.filter(
          (a) => a.severity === "warn"
        ).length} at-risk.`;

  return { summary, advice, atRisk };
}

/**
 * Compact factual context block for the live LLM copilot. Built from the same
 * pure analysis so the LLM enriches phrasing without inventing numbers.
 */
export function buildCopilotContext(state: SimulationState): string {
  const inTransit = state.shipments.filter((s) => s.status === "in-transit");
  const lines: string[] = [];
  const hh = Math.floor(state.hourOfDay).toString().padStart(2, "0");
  const mm = Math.round((state.hourOfDay % 1) * 60)
    .toString()
    .padStart(2, "0");

  lines.push(
    `Chennai cold-chain status at ${hh}:${mm}. Scenario ambient offset: +${state.scenarioOffsetC.toFixed(
      0
    )}°C. Closed roads: ${state.closedEdgeIds.length}.`
  );

  if (inTransit.length === 0) {
    lines.push("No shipments are currently in transit.");
  } else {
    lines.push("In-transit shipments:");
    for (const s of inTransit) {
      const profile = getProduce(s.produce);
      const remaining = remainingTravelHours(s);
      const predLife = predictedShelfLifeHours(s.batch, profile, s.lastTempC);
      const transport =
        s.transportSetpointC != null
          ? `reefer @ ${s.transportSetpointC.toFixed(0)}°C`
          : "ambient truck";
      const verdict = predLife < remaining ? " — WILL SPOIL before arrival" : "";
      lines.push(
        `- ${profile.label} ${s.id}: quality ${s.batch.quality.toFixed(
          0
        )}%, cargo ${s.lastTempC.toFixed(1)}°C, ${transport}, ~${remaining.toFixed(
          1
        )} h to go, est. life left ~${predLife.toFixed(1)} h${verdict}.`
      );
    }
  }

  const report = analyzeFleet(state);
  lines.push(`Heuristic summary: ${report.summary}`);
  return lines.join("\n");
}
