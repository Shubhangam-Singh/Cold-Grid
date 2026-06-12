/**
 * Driver profiles (Phase 9). Each driver has distinct strengths and weaknesses
 * that create real strategic tradeoffs during dispatch. PURE data — no React.
 *
 * Modifiers are multiplicative (1.0 = neutral):
 *  - speedMultiplier: <1 slower, >1 faster
 *  - fuelEfficiency: <1 burns less energy, >1 burns more
 *  - reeferDiscipline: probability 0–1 of maintaining reefer setpoint per leg
 *  - cargoHandling: quality multiplier on loading (1.0 = perfect, <1 = damage)
 *  - trafficNavigation: multiplied into trafficMultiplier (<1 = avoids jams)
 */

export interface DriverProfile {
  id: string;
  name: string;
  avatar: string;
  title: string;
  description: string;
  speedMultiplier: number;
  fuelEfficiency: number;
  reeferDiscipline: number;
  cargoHandling: number;
  trafficNavigation: number;
}

export const DRIVERS: DriverProfile[] = [
  {
    id: "kumar",
    name: "Kumar",
    avatar: "🧔",
    title: "The Veteran",
    description:
      "30 years on Chennai roads. Knows every shortcut, never breaks the cold chain. Slow but flawless.",
    speedMultiplier: 0.9,
    fuelEfficiency: 0.85,
    reeferDiscipline: 1.0,
    cargoHandling: 1.0,
    trafficNavigation: 0.8,
  },
  {
    id: "ravi",
    name: "Ravi",
    avatar: "🏎️",
    title: "The Speedster",
    description:
      "Gets there fast. Drives aggressively — fragile goods may suffer vibration damage. High fuel burn.",
    speedMultiplier: 1.25,
    fuelEfficiency: 1.4,
    reeferDiscipline: 0.95,
    cargoHandling: 0.85,
    trafficNavigation: 1.0,
  },
  {
    id: "priya",
    name: "Priya",
    avatar: "🌿",
    title: "The Eco-Warrior",
    description:
      "Minimizes fuel by coasting and cycling the compressor. Great carbon score, slight thermal risk.",
    speedMultiplier: 0.95,
    fuelEfficiency: 0.6,
    reeferDiscipline: 0.75,
    cargoHandling: 1.0,
    trafficNavigation: 1.0,
  },
  {
    id: "deepak",
    name: "Deepak",
    avatar: "🗺️",
    title: "The Navigator",
    description:
      "Google Maps wizard. Reads traffic like a book and finds gaps others miss. Average in everything else.",
    speedMultiplier: 1.0,
    fuelEfficiency: 1.0,
    reeferDiscipline: 0.9,
    cargoHandling: 0.95,
    trafficNavigation: 0.5,
  },
];

const DRIVER_BY_ID = new Map(DRIVERS.map((d) => [d.id, d]));

export function getDriver(id: string): DriverProfile {
  const d = DRIVER_BY_ID.get(id);
  if (!d) throw new Error(`Unknown driver: ${id}`);
  return d;
}

/** Default driver when none is selected. */
export const DEFAULT_DRIVER_ID = "kumar";
