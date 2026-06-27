import { describe, expect, it } from "vitest";
import { arrheniusRateAt, buildCausalChain } from "./causal";
import type { BatchHistoryPoint } from "../engine/types";

function hist(points: Array<[number, number, number]>): BatchHistoryPoint[] {
  // [ageHours, quality, T_C]
  return points.map(([ageHours, quality, T_C]) => ({ ageHours, quality, T_C, ema: 0 }));
}

describe("causal chain", () => {
  it("Arrhenius rate rises strongly with temperature", () => {
    expect(arrheniusRateAt("fish", 30)).toBeGreaterThan(arrheniusRateAt("fish", 4) * 2);
  });

  it("traces a hot ambient fish run to a temperature breach + spike", () => {
    const c = buildCausalChain({
      produce: "fish",
      reefer: false,
      setpointC: null,
      // warms past fish's 25 °C ceiling, quality collapses
      history: hist([
        [0, 100, 18],
        [1, 80, 27],
        [2, 45, 31],
        [3, 10, 33],
      ]),
      finalQuality: 0,
      spoiled: true,
    });
    expect(c.safeCeilingC).toBeCloseTo(25, 5);
    expect(c.breached).toBe(true);
    expect(c.breachHour).toBe(1); // first point over 25 °C
    expect(c.rateMultiplier).toBeGreaterThan(1);
    expect(c.spoiled).toBe(true);
    expect(c.belowFreshness).toBe(true);
  });

  it("a cold reefer run stays under the ceiling (no breach)", () => {
    const c = buildCausalChain({
      produce: "fish",
      reefer: true,
      setpointC: 2,
      history: hist([
        [0, 100, 2],
        [1, 98, 3],
        [2, 96, 2.5],
      ]),
      finalQuality: 95,
      spoiled: false,
    });
    expect(c.breached).toBe(false);
    expect(c.breachHour).toBeNull();
    expect(c.belowFreshness).toBe(false);
    expect(c.rateMultiplier).toBeLessThanOrEqual(1.5);
  });

  it("is deterministic", () => {
    const args = {
      produce: "milk" as const,
      reefer: false,
      setpointC: null,
      history: hist([[0, 100, 30], [1, 40, 32]]),
      finalQuality: 0,
      spoiled: true,
    };
    expect(buildCausalChain(args)).toEqual(buildCausalChain(args));
  });
});
