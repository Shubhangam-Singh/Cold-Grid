/**
 * Dynamic sell price — exact 5-tier markdown from PPSC v25 firmware
 * (`updateDegradation` in esp32_firmware.cpp).
 *
 *   freshness > 80 → 100% of list
 *   freshness > 60 →  85%
 *   freshness > 40 →  65%
 *   freshness > 20 →  40%
 *   else           →  15%
 *   expired (≤ 0)  →   0
 */

import type { ProduceId } from "./types";
import { getProduce } from "./produce";

export type PriceGrade = "A" | "B" | "C" | "D" | "E" | "expired";
export type SellAdvice = "hold" | "markdown" | "sell-now" | "distress" | "unsellable";

export interface PriceQuote {
  basePriceRs: number;
  recommendedRs: number;
  discountPct: number;
  grade: PriceGrade;
  advice: SellAdvice;
  reason: string;
}

function markdownFactor(freshness: number): { factor: number; grade: PriceGrade } {
  if (freshness <= 0) return { factor: 0, grade: "expired" };
  if (freshness > 80) return { factor: 1, grade: "A" };
  if (freshness > 60) return { factor: 0.85, grade: "B" };
  if (freshness > 40) return { factor: 0.65, grade: "C" };
  if (freshness > 20) return { factor: 0.4, grade: "D" };
  return { factor: 0.15, grade: "E" };
}

export function recommendSellPrice(args: {
  produce: ProduceId;
  qualityPct: number;
}): PriceQuote {
  const basePriceRs = getProduce(args.produce).basePriceRs;
  const { factor, grade } = markdownFactor(args.qualityPct);
  const recommendedRs = Math.round(basePriceRs * factor * 10) / 10;
  const discountPct = Math.round((1 - factor) * 100);

  let advice: SellAdvice;
  let reason: string;
  if (grade === "expired") {
    advice = "unsellable";
    reason = "Expired — do not sell.";
  } else if (grade === "A") {
    advice = "hold";
    reason = "Grade A — list price.";
  } else if (grade === "B") {
    advice = "markdown";
    reason = "Grade B — 15% off list.";
  } else if (grade === "C") {
    advice = "sell-now";
    reason = "Grade C — 35% off. Sell now.";
  } else if (grade === "D") {
    advice = "distress";
    reason = "Grade D — 60% off. Move it today.";
  } else {
    advice = "distress";
    reason = "Grade E — 85% off. Salvage or divert.";
  }

  return { basePriceRs, recommendedRs, discountPct, grade, advice, reason };
}
