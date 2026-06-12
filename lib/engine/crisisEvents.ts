/**
 * Mid-transit crisis events (Phase 9). Deterministic random events that strike
 * shipments during transit, demanding real-time operator decisions.
 *
 * PURE TypeScript — no React, no DOM. Crisis generation is a pure function of
 * (seed, shipmentId, legIndex) for full determinism/replay.
 */

import { mulberry32 } from "./rng";
import { getEdge, getNode, planRoute, CHENNAI_NODES, haversineKm } from "../city/chennai";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CrisisType = "road_accident" | "reefer_breakdown" | "tire_blowout";

export interface CrisisOption {
  id: string;
  label: string;
  description: string;
  effect: CrisisEffect;
}

export type CrisisEffect =
  | { type: "reroute"; newEdgeIds: string[] }
  | { type: "wait"; delayMinutes: number }
  | { type: "reefer_off" }
  | { type: "push_through"; speedPenalty: number }
  | { type: "divert_to_hub"; hubId: string; hubName: string; newEdgeIds: string[] };

export interface CrisisEvent {
  id: string;
  type: CrisisType;
  title: string;
  description: string;
  icon: string;
  shipmentId: string;
  edgeId: string;
  triggerTick: number;
  resolved: boolean;
  chosenOptionId: string | null;
  options: CrisisOption[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Crisis metadata
// ─────────────────────────────────────────────────────────────────────────────

const CRISIS_META: Record<
  CrisisType,
  { title: string; description: string; icon: string }
> = {
  road_accident: {
    title: "Road Accident Ahead",
    description:
      "A multi-vehicle collision is blocking the road ahead. Traffic is at a standstill.",
    icon: "🚧",
  },
  reefer_breakdown: {
    title: "Reefer Compressor Failure",
    description:
      "The refrigeration unit has malfunctioned. Cargo temperature is rising toward ambient.",
    icon: "❄️",
  },
  tire_blowout: {
    title: "Tire Blowout",
    description:
      "A tire has blown out on the road. The truck needs emergency repair before continuing.",
    icon: "💥",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hub nearest-neighbour helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find the nearest cold hub to the truck's current edge start node,
 * excluding the truck's own destination (so we don't "divert" to where
 * it's already going) and hubs that are unreachable under current closures.
 */
function findNearestHub(
  currentEdgeId: string,
  destinationId: string,
  closedEdgeIds: string[]
): { hubId: string; hubName: string; route: string[] } | null {
  const edge = getEdge(currentEdgeId);
  const fromNodeId = edge.from;
  const fromNode = getNode(fromNodeId);

  const hubs = CHENNAI_NODES.filter(
    (n) => n.type === "hub" && n.id !== destinationId
  );

  let best: { hubId: string; hubName: string; route: string[]; dist: number } | null = null;

  for (const hub of hubs) {
    // Check a route exists from current edge start to hub
    const route = planRoute(fromNodeId, hub.id, { closedEdgeIds });
    if (!route || route.length === 0) continue;

    // Use straight-line distance as tiebreaker (route length is primary)
    const dist = haversineKm(fromNode.coordinates, hub.coordinates);
    if (!best || dist < best.dist) {
      best = { hubId: hub.id, hubName: hub.name, route, dist };
    }
  }

  return best ? { hubId: best.hubId, hubName: best.hubName, route: best.route } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic crisis generation
// ─────────────────────────────────────────────────────────────────────────────

/** Probability per leg of a crisis firing. Tunable. */
const CRISIS_PROBABILITY = 0.12;

/**
 * Deterministic noise for crisis generation. Same (seed, shipmentId, legIndex)
 * always produces the same result.
 */
function crisisNoise(seed: number, shipmentId: string, legIndex: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < shipmentId.length; i++) {
    h = Math.imul(h ^ shipmentId.charCodeAt(i), 0x01000193) >>> 0;
  }
  h = Math.imul(h ^ (legIndex + 0x6d2b79f5), 0x85ebca6b) >>> 0;
  return mulberry32(h)();
}

/**
 * Check if a crisis should fire for a shipment entering a new leg.
 * Returns the crisis type or null.
 */
export function shouldCrisisFire(
  seed: number,
  shipmentId: string,
  legIndex: number,
  isReefer: boolean,
  congestionProne: boolean
): CrisisType | null {
  const roll = crisisNoise(seed, shipmentId, legIndex);
  if (roll > CRISIS_PROBABILITY) return null;

  // Weight crisis types by context
  const typeRoll = crisisNoise(seed, shipmentId + "_type", legIndex);

  if (isReefer && typeRoll < 0.35) return "reefer_breakdown";
  if (congestionProne && typeRoll < 0.7) return "road_accident";
  return "tire_blowout";
}

/**
 * Generate the response options for a crisis.
 */
export function generateCrisisOptions(
  crisisType: CrisisType,
  shipmentId: string,
  currentEdgeId: string,
  destinationId: string,
  closedEdgeIds: string[]
): CrisisOption[] {
  const edge = getEdge(currentEdgeId);
  const options: CrisisOption[] = [];

  switch (crisisType) {
    case "road_accident": {
      // Option 1: Wait it out
      options.push({
        id: "wait",
        label: "Wait for Clearance",
        description: "Wait 20 minutes for the accident to clear. Cargo keeps degrading.",
        effect: { type: "wait", delayMinutes: 20 },
      });

      // Option 2: Find a completely new route from the current location to the destination
      const altRoute = planRoute(edge.from, destinationId, {
        closedEdgeIds: [...closedEdgeIds, currentEdgeId],
      });
      if (altRoute && altRoute.length > 0) {
        const altEdge = getEdge(altRoute[0]);
        options.push({
          id: "reroute",
          label: `Reroute via ${getNode(altEdge.to).name}`,
          description: `Take a completely new route to the destination. Avoids the accident.`,
          effect: { type: "reroute", newEdgeIds: altRoute },
        });
      }

      // Option 3: Push through slowly
      options.push({
        id: "push",
        label: "Push Through Slowly",
        description: "Crawl past the accident at half speed. Risky but direct.",
        effect: { type: "push_through", speedPenalty: 0.4 },
      });

      // Option 4: Divert to nearest cold hub (safe haven)
      const hubForAccident = findNearestHub(currentEdgeId, destinationId, closedEdgeIds);
      if (hubForAccident) {
        options.push({
          id: "divert_hub",
          label: `❄️ Divert → ${hubForAccident.hubName}`,
          description: `Park cargo safely in refrigerated storage at ${hubForAccident.hubName} while the road clears.`,
          effect: {
            type: "divert_to_hub",
            hubId: hubForAccident.hubId,
            hubName: hubForAccident.hubName,
            newEdgeIds: hubForAccident.route,
          },
        });
      }
      break;
    }

    case "reefer_breakdown": {
      // Option 1: Accept ambient
      options.push({
        id: "ambient",
        label: "Continue Ambient",
        description: "Keep driving without refrigeration. Cargo will warm rapidly.",
        effect: { type: "reefer_off" },
      });

      // Option 2: Emergency roadside repair
      options.push({
        id: "wait",
        label: "Roadside Repair",
        description: "Stop for 15 minutes to attempt a field repair. 50/50 success.",
        effect: { type: "wait", delayMinutes: 15 },
      });

      // Option 3: Divert to nearest cold hub — most important for reefer failure!
      const hubForReefer = findNearestHub(currentEdgeId, destinationId, closedEdgeIds);
      if (hubForReefer) {
        options.push({
          id: "divert_hub",
          label: `❄️ Divert → ${hubForReefer.hubName}`,
          description: `Rush to ${hubForReefer.hubName} cold storage. Cargo saved at hub refrigeration setpoint.`,
          effect: {
            type: "divert_to_hub",
            hubId: hubForReefer.hubId,
            hubName: hubForReefer.hubName,
            newEdgeIds: hubForReefer.route,
          },
        });
      }

      // Option 4: Push through fast to destination
      options.push({
        id: "push",
        label: "Sprint to Destination",
        description: "Drive fast without reefer — minimize the warm window.",
        effect: { type: "push_through", speedPenalty: 1.3 },
      });
      break;
    }

    case "tire_blowout": {
      // Option 1: Change tire
      options.push({
        id: "wait",
        label: "Change the Tire",
        description: "Stop for 12 minutes to change the flat tire.",
        effect: { type: "wait", delayMinutes: 12 },
      });

      // Option 2: Limp to destination
      options.push({
        id: "push",
        label: "Limp On the Rim",
        description: "Continue driving at half speed on the damaged tire.",
        effect: { type: "push_through", speedPenalty: 0.5 },
      });
      break;
    }
  }

  return options;
}

/**
 * Create a full CrisisEvent from its parameters.
 */
export function createCrisis(
  crisisType: CrisisType,
  shipmentId: string,
  edgeId: string,
  destinationId: string,
  tick: number,
  closedEdgeIds: string[]
): CrisisEvent {
  const meta = CRISIS_META[crisisType];
  return {
    id: `crisis-${shipmentId}-${tick}`,
    type: crisisType,
    title: meta.title,
    description: meta.description,
    icon: meta.icon,
    shipmentId,
    edgeId,
    triggerTick: tick,
    resolved: false,
    chosenOptionId: null,
    options: generateCrisisOptions(crisisType, shipmentId, edgeId, destinationId, closedEdgeIds),
  };
}
