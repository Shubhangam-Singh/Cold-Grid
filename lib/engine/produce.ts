/**
 * Produce database — Arrhenius core from spec §5.3, H/G/γ/floors/k0/list-price
 * from PPSC v25 firmware (`esp32_firmware.cpp` DB[]).
 *
 * λ is NOT copied from the cart. Firmware λ (0.995–0.9975) is derived for a
 * 2-second sensor tick. This sim ticks at 0.01 h, so we keep the hour-scale λ
 * (0.87–0.94) that gives the same 20–40 min biological persistence.
 *
 * Ea, shelf life, thermalStressK: do not invent replacements (RULE 2).
 */

import type { ProduceId, ProduceProfile } from "./types";

const KJ_TO_J = 1000;

function profile(p: {
  id: ProduceId;
  label: string;
  eaKJ: number;
  shelfLifeHours: number;
  lambda: number;
  thermalStressK: number;
  k0: number;
  gamma: number;
  fMin: number;
  eaMinFrac: number;
  betaRate: number;
  rhRef: number;
  sRh: number;
  alphaRate: number;
  vocRef: number;
  sVoc: number;
  basePriceRs: number;
}): ProduceProfile {
  return {
    id: p.id,
    label: p.label,
    eaBase: p.eaKJ * KJ_TO_J,
    shelfLifeHours: p.shelfLifeHours,
    lambda: p.lambda,
    thermalStressK: p.thermalStressK,
    k0: p.k0,
    gamma: p.gamma,
    fMin: p.fMin,
    eaMinFrac: p.eaMinFrac,
    betaRate: p.betaRate,
    rhRef: p.rhRef,
    sRh: p.sRh,
    alphaRate: p.alphaRate,
    vocRef: p.vocRef,
    sVoc: p.sVoc,
    basePriceRs: p.basePriceRs,
  };
}

/**
 * Eight produce profiles. Ea / shelf / Tstress from §5.3.
 * Remaining fields from PPSC v25 DB[] (firmware comments cite the same papers).
 */
export const PRODUCE: Record<ProduceId, ProduceProfile> = {
  tomato: profile({
    id: "tomato", label: "Tomato", eaKJ: 109.7, shelfLifeHours: 90, lambda: 0.93, thermalStressK: 303.15,
    k0: 1.277e17, gamma: 0.03, fMin: 0.97, eaMinFrac: 0.97,
    betaRate: 0.2, rhRef: 75, sRh: 25, alphaRate: 0.15, vocRef: 120, sVoc: 150, basePriceRs: 20,
  }),
  banana: profile({
    id: "banana", label: "Banana", eaKJ: 60.9, shelfLifeHours: 120, lambda: 0.91, thermalStressK: 301.15,
    k0: 2.701e8, gamma: 0.03, fMin: 0.97, eaMinFrac: 0.97,
    betaRate: 0.2, rhRef: 75, sRh: 25, alphaRate: 0.15, vocRef: 100, sVoc: 130, basePriceRs: 15,
  }),
  apple: profile({
    id: "apple", label: "Apple", eaKJ: 90.0, shelfLifeHours: 168, lambda: 0.94, thermalStressK: 301.15,
    k0: 2.419e13, gamma: 0.02, fMin: 0.98, eaMinFrac: 0.98,
    betaRate: 0.15, rhRef: 85, sRh: 20, alphaRate: 0.1, vocRef: 110, sVoc: 150, basePriceRs: 80,
  }),
  leafyVeg: profile({
    id: "leafyVeg", label: "Leafy Veg", eaKJ: 44.5, shelfLifeHours: 48, lambda: 0.88, thermalStressK: 298.15,
    k0: 9.038e5, gamma: 0.05, fMin: 0.95, eaMinFrac: 0.95,
    betaRate: 0.25, rhRef: 85, sRh: 20, alphaRate: 0.1, vocRef: 80, sVoc: 120, basePriceRs: 30,
  }),
  mango: profile({
    id: "mango", label: "Mango", eaKJ: 50.0, shelfLifeHours: 96, lambda: 0.92, thermalStressK: 303.15,
    k0: 4.156e6, gamma: 0.03, fMin: 0.97, eaMinFrac: 0.97,
    betaRate: 0.3, rhRef: 75, sRh: 25, alphaRate: 0.15, vocRef: 100, sVoc: 140, basePriceRs: 60,
  }),
  milk: profile({
    id: "milk", label: "Milk", eaKJ: 90.0, shelfLifeHours: 5.5, lambda: 0.92, thermalStressK: 298.15,
    k0: 7.39e14, gamma: 0.04, fMin: 0.96, eaMinFrac: 0.96,
    betaRate: 0, rhRef: 99, sRh: 10, alphaRate: 0.25, vocRef: 90, sVoc: 100, basePriceRs: 25,
  }),
  fish: profile({
    id: "fish", label: "Fish", eaKJ: 82.9, shelfLifeHours: 17.4, lambda: 0.87, thermalStressK: 298.15,
    k0: 1.332e13, gamma: 0.05, fMin: 0.95, eaMinFrac: 0.95,
    betaRate: 0.08, rhRef: 80, sRh: 20, alphaRate: 0.4, vocRef: 80, sVoc: 100, basePriceRs: 150,
  }),
  paneer: profile({
    id: "paneer", label: "Paneer", eaKJ: 52.8, shelfLifeHours: 24, lambda: 0.91, thermalStressK: 298.15,
    k0: 5.144e7, gamma: 0.04, fMin: 0.96, eaMinFrac: 0.96,
    betaRate: 0.1, rhRef: 80, sRh: 20, alphaRate: 0.2, vocRef: 100, sVoc: 130, basePriceRs: 90,
  }),
};

export const PRODUCE_IDS = Object.keys(PRODUCE) as ProduceId[];

export function getProduce(id: ProduceId): ProduceProfile {
  return PRODUCE[id];
}
