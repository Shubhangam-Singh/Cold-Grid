import { describe, expect, it } from "vitest";
import { recommendSellPrice } from "./pricing";

describe("PPSC v25 5-tier sell price", () => {
  it("grade A (freshness > 80) is full list price", () => {
    const q = recommendSellPrice({ produce: "fish", qualityPct: 100 });
    expect(q.basePriceRs).toBe(150);
    expect(q.recommendedRs).toBe(150);
    expect(q.grade).toBe("A");
    expect(q.discountPct).toBe(0);
    expect(q.advice).toBe("hold");
  });

  it("matches firmware bands at the boundaries", () => {
    expect(recommendSellPrice({ produce: "fish", qualityPct: 81 }).recommendedRs).toBe(150);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 80 }).recommendedRs).toBe(127.5);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 61 }).recommendedRs).toBe(127.5);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 60 }).recommendedRs).toBe(97.5);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 41 }).recommendedRs).toBe(97.5);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 40 }).recommendedRs).toBe(60);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 21 }).recommendedRs).toBe(60);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 20 }).recommendedRs).toBe(22.5);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 0 }).recommendedRs).toBe(0);
    expect(recommendSellPrice({ produce: "fish", qualityPct: 0 }).grade).toBe("expired");
  });

  it("uses firmware list prices (INR / unit)", () => {
    expect(recommendSellPrice({ produce: "tomato", qualityPct: 100 }).basePriceRs).toBe(20);
    expect(recommendSellPrice({ produce: "banana", qualityPct: 100 }).basePriceRs).toBe(15);
    expect(recommendSellPrice({ produce: "apple", qualityPct: 100 }).basePriceRs).toBe(80);
    expect(recommendSellPrice({ produce: "leafyVeg", qualityPct: 100 }).basePriceRs).toBe(30);
    expect(recommendSellPrice({ produce: "mango", qualityPct: 100 }).basePriceRs).toBe(60);
    expect(recommendSellPrice({ produce: "milk", qualityPct: 100 }).basePriceRs).toBe(25);
    expect(recommendSellPrice({ produce: "paneer", qualityPct: 100 }).basePriceRs).toBe(90);
  });
});
