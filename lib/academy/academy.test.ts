import { describe, expect, it } from "vitest";
import {
  FRAGILE,
  SCENARIOS,
  getScenario,
  suggestedDecisions,
} from "./scenarios";
import { simulateScenario } from "./run";
import { certificationLevel, scoreScenario } from "./scoring";
import type { DeliveryDecision } from "./types";
import { getNode } from "../city/chennai";
import { PRODUCE_IDS } from "../engine/produce";

/** All-ambient plan: dispatch everything, no refrigeration. */
function ambientPlan(scenarioId: string): DeliveryDecision[] {
  return getScenario(scenarioId).requiredDeliveries.map((d) => ({
    deliveryId: d.id,
    dispatched: true,
    reefer: false,
    setpointC: 4,
  }));
}

describe("scenario data integrity", () => {
  it("has exactly five scenarios, indexed 1..5", () => {
    expect(SCENARIOS).toHaveLength(5);
    expect(SCENARIOS.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
  });

  it("every delivery references real nodes and an existing produce", () => {
    for (const s of SCENARIOS) {
      expect(s.requiredDeliveries.length).toBeGreaterThan(0);
      for (const d of s.requiredDeliveries) {
        expect(() => getNode(d.fromId)).not.toThrow();
        expect(() => getNode(d.toId)).not.toThrow();
        expect(PRODUCE_IDS).toContain(d.produce);
      }
    }
  });

  it("closed edges reference the flood-prone roads", () => {
    const monsoon = getScenario("monsoon");
    expect(monsoon.closedEdgeIds.length).toBeGreaterThan(0);
  });
});

describe("each scenario is completable and a sound plan earns 3 stars", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.id}: suggested plan terminates and scores 3 stars`, () => {
      const decisions = suggestedDecisions(scenario);
      const run = simulateScenario(scenario, decisions);
      expect(run.ticks).toBeLessThan(200000); // no hang
      expect(run.results.every((r) => !r.dispatched || r.transitHours > 0)).toBe(true);
      const score = scoreScenario(scenario, run.results);
      expect(score.stars, `${scenario.id} composite ${score.composite.toFixed(1)}`).toBe(3);
    });
  }
});

describe("scoring discriminates good play from bad", () => {
  it("heatwave: refrigerating beats running ambient", () => {
    const s = getScenario("heatwave");
    const good = scoreScenario(s, simulateScenario(s, suggestedDecisions(s)).results);
    const bad = scoreScenario(s, simulateScenario(s, ambientPlan("heatwave")).results);
    expect(good.foodSavedPct).toBeGreaterThan(bad.foodSavedPct);
    expect(good.composite).toBeGreaterThan(bad.composite);
    expect(bad.stars).toBeLessThan(3);
  });

  it("grid outage: refrigerating EVERYTHING busts the generator budget", () => {
    const s = getScenario("grid-outage");
    const reeferAll: DeliveryDecision[] = s.requiredDeliveries.map((d) => ({
      deliveryId: d.id,
      dispatched: true,
      reefer: true,
      setpointC: 2,
    }));
    const score = scoreScenario(s, simulateScenario(s, reeferAll).results);
    expect(score.overBudget).toBe(true);
    expect(score.breakdown.budgetPenalty).toBeGreaterThan(0);

    // The triage plan (reefer only fragile) stays within budget and scores better.
    const triage = scoreScenario(s, simulateScenario(s, suggestedDecisions(s)).results);
    expect(triage.overBudget).toBe(false);
    expect(triage.composite).toBeGreaterThan(score.composite);
  });
});

describe("determinism (RULE 4)", () => {
  it("identical decisions produce identical scores", () => {
    const s = getScenario("festival-surge");
    const a = scoreScenario(s, simulateScenario(s, suggestedDecisions(s)).results);
    const b = scoreScenario(s, simulateScenario(s, suggestedDecisions(s)).results);
    expect(a).toEqual(b);
  });
});

describe("certification", () => {
  it("perfect across all scenarios → Chief; zero → Trainee", () => {
    const max = SCENARIOS.length * 3;
    expect(certificationLevel(max, SCENARIOS.length).level).toBe("Chief Cold-Chain Officer");
    expect(certificationLevel(0, SCENARIOS.length).level).toBe("Trainee");
  });

  it("FRAGILE list and suggested plan refrigerate the right produce", () => {
    const s = getScenario("grid-outage");
    const plan = suggestedDecisions(s);
    for (const d of s.requiredDeliveries) {
      const decision = plan.find((p) => p.deliveryId === d.id)!;
      expect(decision.reefer).toBe(FRAGILE.includes(d.produce));
    }
  });
});
