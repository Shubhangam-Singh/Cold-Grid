/**
 * The cart's EMA λ is derived for a 2-second sensor loop (PPSC v25/v26).
 * ColdGrid's map simulation uses a slower λ because its tick is ~36 seconds.
 * Live cart readings must step with the firmware λ. This returns a copy —
 * `getProduce()` profiles stay on the simulation clock.
 */

import type { ProduceId, ProduceProfile } from "../engine/types";

/** λ = exp(−2.9957 × 2 / τ_bio) from esp32_firmware.cpp DB[]. */
export const FIRMWARE_LAMBDA: Record<ProduceId, number> = {
  tomato: 0.997151,
  banana: 0.996677,
  apple: 0.997507,
  leafyVeg: 0.99502,
  mango: 0.996677,
  milk: 0.996014,
  fish: 0.996014,
  paneer: 0.996014,
};

export function withFirmwareClock(profile: ProduceProfile): ProduceProfile {
  return { ...profile, lambda: FIRMWARE_LAMBDA[profile.id] };
}
