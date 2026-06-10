import { describe, expect, it } from "vitest";
import { mulberry32, randInt, randPick, randRange } from "./rng";

describe("mulberry32 (RULE 4 — determinism)", () => {
  it("identical seeds produce identical sequences", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("outputs stay in [0, 1)", () => {
    const rng = mulberry32(123456789);
    for (let i = 0; i < 10000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("randRange stays within [min, max)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = randRange(rng, 28, 38);
      expect(x).toBeGreaterThanOrEqual(28);
      expect(x).toBeLessThan(38);
    }
  });

  it("randInt covers both inclusive endpoints", () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(randInt(rng, 0, 3));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  it("randPick throws on an empty array", () => {
    const rng = mulberry32(1);
    expect(() => randPick(rng, [])).toThrow();
  });
});
