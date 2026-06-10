/**
 * Seeded pseudo-random number generator (RULE 4 — determinism).
 *
 * ALL randomness in ColdGrid must flow through an Rng created here.
 * Never call Math.random() in the engine, the simulation, or scenarios:
 * a given seed must replay identically every time, so demo recordings
 * and headless tests are exactly reproducible.
 */

/** Returns a float in [0, 1), like Math.random() but deterministic. */
export type Rng = () => number;

/**
 * mulberry32 — small, fast 32-bit seeded PRNG with good statistical
 * quality for simulation purposes (not cryptographic).
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max] (both inclusive). */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

/** Pick one element of a non-empty array. */
export function randPick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("randPick: empty array");
  }
  return items[randInt(rng, 0, items.length - 1)];
}
