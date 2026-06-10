import { describe, expect, it } from "vitest";
import {
  R,
  T_REF_K,
  baseRate,
  createBatch,
  emaUpdate,
  gasMultiplier,
  humidityMultiplier,
  isSpoiled,
  predictedShelfLifeHours,
  stepBatch,
  thermalDerating,
} from "./spoilage";
import { PRODUCE, PRODUCE_IDS, getProduce } from "./produce";
import type { Batch, ProduceProfile } from "./types";

const tomato = getProduce("tomato");
const fish = getProduce("fish");
const apple = getProduce("apple");

/** Step a fresh batch n times at constant conditions. */
function run(
  p: ProduceProfile,
  T_C: number,
  n: number,
  dtHours = 1,
  RH = p.rhRef,
  VOC = p.vocRef
): Batch {
  let b = createBatch("t", p.id);
  for (let i = 0; i < n; i++) {
    b = stepBatch(b, p, T_C, RH, VOC, dtHours);
  }
  return b;
}

describe("§5.5 #1 — quality is monotonically non-increasing", () => {
  it("never rises across 200 ticks at a stressful constant temperature", () => {
    let b = createBatch("m", tomato.id);
    let prev = b.quality;
    for (let i = 0; i < 200; i++) {
      b = stepBatch(b, tomato, 34, 88, 70, 1);
      expect(b.quality).toBeLessThanOrEqual(prev + 1e-12);
      prev = b.quality;
    }
  });
});

describe("§5.5 #2 — warmer ⇒ strictly faster quality loss", () => {
  it("a hotter batch is strictly lower quality after the same dt", () => {
    const cool = run(tomato, 25, 5);
    const hot = run(tomato, 35, 5);
    expect(hot.quality).toBeLessThan(cool.quality);
  });
});

describe("§5.5 #3 — λ controls EMA inertia (thermal memory)", () => {
  // The patented step-2 formula EMA = λ·EMA + (1−λ)·u_t makes λ the
  // memory-RETENTION weight, so a HIGHER λ responds MORE SLOWLY to a step
  // change (more inertia). NOTE: the spec's prose for this test reads
  // "lower λ → slower response", which is inverted relative to the step-2
  // formula it also specifies; the formula is the patented mechanism (RULE 2)
  // and matches the physical ordering of the §5.3 λ values (Fish 0.87 reacts
  // fast, Apple 0.94 is buffered), so we preserve the formula and assert its
  // true behaviour. Flagged in the Phase 1 report.
  it("after a temperature step, higher λ yields a lower (slower-rising) EMA", () => {
    const base = tomato;
    const highLambda: ProduceProfile = { ...base, lambda: 0.99 };
    const lowLambda: ProduceProfile = { ...base, lambda: 0.8 };
    const T_K = 313.15; // 40 °C — well above tomato's 30 °C stress threshold

    let emaHigh = 0;
    let emaLow = 0;
    for (let i = 0; i < 10; i++) {
      emaHigh = emaUpdate(emaHigh, T_K, highLambda);
      emaLow = emaUpdate(emaLow, T_K, lowLambda);
    }

    expect(emaHigh).toBeLessThan(emaLow); // high λ = more inertia = slower
    // Both converge toward the same steady state u_t = (313.15−303.15)/10 = 1.0
    expect(emaLow).toBeGreaterThan(emaHigh);
    expect(emaLow).toBeLessThanOrEqual(1.0 + 1e-9);
  });
});

describe("§5.5 #4 — H and G are pure POST-multipliers ≥ 1", () => {
  it("H = G = 1 exactly at the reference RH/VOC", () => {
    expect(humidityMultiplier(tomato.rhRef, tomato)).toBe(1);
    expect(gasMultiplier(tomato.vocRef, tomato)).toBe(1);
  });

  it("H and G never drop below 1 (including below-reference inputs)", () => {
    for (const id of PRODUCE_IDS) {
      const p = PRODUCE[id];
      for (let rh = 0; rh <= 100; rh += 5) {
        expect(humidityMultiplier(rh, p)).toBeGreaterThanOrEqual(1);
      }
      for (let voc = 0; voc <= 400; voc += 10) {
        expect(gasMultiplier(voc, p)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("H and G rise above 1 above the reference", () => {
    expect(humidityMultiplier(tomato.rhRef + 20, tomato)).toBeGreaterThan(1);
    expect(gasMultiplier(tomato.vocRef + 100, tomato)).toBeGreaterThan(1);
  });
});

describe("§5.5 #5 — units guard (kJ/mol vs J/mol)", () => {
  it("baseRate matches an independent closed-form value within 1e-6", () => {
    const T_K = 308.15; // 35 °C
    const EaEff = tomato.eaBase; // no derating
    const expected = Math.exp((tomato.eaBase / T_REF_K - EaEff / T_K) / R);
    expect(baseRate(T_K, EaEff, tomato)).toBeCloseTo(expected, 12);
  });

  it("baseRate equals the hand-computed ~4.2045 for Tomato at 35 °C, NOT ~1.0", () => {
    // Hand calc: exp((109700/298.15 − 109700/308.15)/8.314) ≈ 4.2045.
    // If Ea were left in kJ (units bug), this would be ≈ 1.0014 — far below 2.
    const v = baseRate(308.15, tomato.eaBase, tomato);
    expect(v).toBeCloseTo(4.2045, 2);
    expect(v).toBeGreaterThan(2); // catches the kJ→J mistake
  });
});

describe("§5.5 #6 — F and Ea_eff stay within bounds", () => {
  it("F never drops below fMin and Ea_eff stays within [eaMinFrac·Ea, Ea]", () => {
    for (const id of PRODUCE_IDS) {
      const p = PRODUCE[id];
      for (let ema = 0; ema <= 50; ema += 0.5) {
        const { F, EaEff } = thermalDerating(ema, p);
        expect(F).toBeGreaterThanOrEqual(p.fMin);
        expect(EaEff).toBeGreaterThanOrEqual(p.eaMinFrac * p.eaBase - 1e-9);
        expect(EaEff).toBeLessThanOrEqual(p.eaBase + 1e-9);
      }
    }
  });

  it("clamps hit their bounds at the extremes", () => {
    const zero = thermalDerating(0, tomato);
    expect(zero.F).toBe(1);
    expect(zero.EaEff).toBeCloseTo(tomato.eaBase, 9); // upper bound at EMA=0

    const huge = thermalDerating(1000, tomato);
    expect(huge.F).toBe(tomato.fMin); // floored
    expect(huge.EaEff).toBeCloseTo(tomato.eaMinFrac * tomato.eaBase, 9);
  });
});

describe("§5.5 #7 — quality clamps at 0, never negative or NaN", () => {
  it("a hot fish batch reaches exactly 0 and stays there", () => {
    let b = createBatch("q", fish.id);
    for (let i = 0; i < 100; i++) {
      b = stepBatch(b, fish, 42, 95, 200, 1);
      expect(Number.isNaN(b.quality)).toBe(false);
      expect(b.quality).toBeGreaterThanOrEqual(0);
      expect(b.quality).toBeLessThanOrEqual(100);
    }
    expect(b.quality).toBe(0);
  });
});

describe("§5.5 #8 — determinism", () => {
  it("identical inputs produce identical outputs across two runs", () => {
    const a = run(tomato, 33, 50);
    const b = run(tomato, 33, 50);
    expect(a).toEqual(b);
  });
});

describe("§5.5 #9 — cross-produce sanity (physical ordering)", () => {
  it("fish at 30 °C spoils dramatically faster than apple at 30 °C", () => {
    const fishB = run(fish, 30, 24); // 24 one-hour ticks
    const appleB = run(apple, 30, 24);
    expect(fishB.quality).toBeLessThan(appleB.quality);
    expect(isSpoiled(fishB, fish)).toBe(true);
    expect(isSpoiled(appleB, apple)).toBe(false);
    expect(appleB.quality).toBeGreaterThan(0);
  });
});

describe("§5.5 #10 — stepBatch is pure (no input mutation)", () => {
  it("does not mutate the input batch or its history array", () => {
    const input = createBatch("p", tomato.id);
    const snapshot = JSON.parse(JSON.stringify(input));
    const result = stepBatch(input, tomato, 36, 90, 120, 1);

    expect(input).toEqual(snapshot); // input untouched
    expect(result).not.toBe(input);
    expect(result.history).not.toBe(input.history);
    expect(input.history).toHaveLength(0);
    expect(result.history).toHaveLength(1);
  });
});

describe("supporting checks", () => {
  it("predictedShelfLifeHours ~ shelfLifeHours at reference temperature when fresh", () => {
    const fresh = createBatch("s", tomato.id);
    const pred = predictedShelfLifeHours(fresh, tomato, 25);
    expect(pred).toBeCloseTo(tomato.shelfLifeHours, 6); // baseRate = 1 at 25 °C, EMA=0
  });

  it("predictedShelfLifeHours shrinks at higher assumed temperature", () => {
    const fresh = createBatch("s", tomato.id);
    const warm = predictedShelfLifeHours(fresh, tomato, 38);
    const cool = predictedShelfLifeHours(fresh, tomato, 25);
    expect(warm).toBeLessThan(cool);
  });

  it("predictedShelfLifeHours is 0 for a spoiled batch", () => {
    const spoiled = run(fish, 42, 100);
    expect(predictedShelfLifeHours(spoiled, fish, 4)).toBe(0);
  });

  it("every produce profile stores Ea in J/mol (×1000 from the kJ table)", () => {
    expect(tomato.eaBase).toBe(109700);
    expect(fish.eaBase).toBe(82900);
    expect(apple.eaBase).toBe(90000);
  });
});
