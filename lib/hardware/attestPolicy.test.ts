import { describe, expect, it } from "vitest";
import { emptyAttestCursor, shouldAttest } from "./attestPolicy";

const threshold = 25;

describe("shouldAttest", () => {
  it("posts the first sample and then skips a quiet follow-up", () => {
    const first = shouldAttest(emptyAttestCursor(), { tempC: 23.6, at: 1_000 }, threshold);
    expect(first).toMatchObject({ post: true, reason: "first" });
    const skip = shouldAttest(first.next, { tempC: 23.8, at: 1_002 }, threshold);
    expect(skip.post).toBe(false);
    expect(skip.reason).toBe("skip");
    expect(skip.next).toBe(first.next);
  });

  it("posts when temperature crosses the threshold, ahead of the 1°C rule", () => {
    const first = shouldAttest(emptyAttestCursor(), { tempC: 24.2, at: 1_000 }, threshold);
    const edge = shouldAttest(first.next, { tempC: 26.4, at: 1_002 }, threshold);
    expect(edge.reason).toBe("breach-edge");
    const back = shouldAttest(edge.next, { tempC: 24.9, at: 1_004 }, threshold);
    expect(back.reason).toBe("breach-edge");
    expect(back.next.wasBreach).toBe(false);
  });

  it("posts a 1°C move that stays on the same side of the threshold", () => {
    const first = shouldAttest(emptyAttestCursor(), { tempC: 20, at: 1_000 }, threshold);
    const moved = shouldAttest(first.next, { tempC: 21, at: 1_010 }, threshold);
    expect(moved.reason).toBe("delta");
    const tiny = shouldAttest(moved.next, { tempC: 21.9, at: 1_020 }, threshold);
    expect(tiny.reason).toBe("skip");
  });

  it("posts on the 60 second mark", () => {
    const first = shouldAttest(emptyAttestCursor(), { tempC: 20, at: 1_000 }, threshold);
    const early = shouldAttest(first.next, { tempC: 20.2, at: 1_059 }, threshold);
    expect(early.reason).toBe("skip");
    const due = shouldAttest(first.next, { tempC: 20.2, at: 1_060 }, threshold);
    expect(due.reason).toBe("interval");
  });
});
