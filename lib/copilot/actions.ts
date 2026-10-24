/**
 * Confirm-gated moves. Rupees and hours come from recommendSellPrice and
 * the spoilage engine. The caller applies a hold only after the admin confirms.
 */

import { CHENNAI_NODES, getEdge, getNode, nodeHoldingTempC, planRoute } from "../city/chennai";
import { getProduce } from "../engine/produce";
import { recommendSellPrice } from "../engine/pricing";
import { degradationSnapshot, predictedShelfLifeHours } from "../engine/spoilage";
import type { Shipment } from "../engine/simulation";
import { HUB_FEE_PER_HOUR_RUPEES } from "../logistics/hubHold";
import { remainingTravelHours } from "./heuristics";
import { cargoReading, unprobedCargoC, type CopilotWorld } from "./world";

export type ActionKind = "keep-driving" | "sell-now" | "hold-hub" | "divert-kitchen";

export interface ActionCard {
  id: string;
  kind: ActionKind;
  shipmentId: string;
  title: string;
  detail: string;
  rupees: number;
  lifeHours: number | null;
  tempC: number;
  hubId?: string;
  kitchenId?: string;
  /** Price band from recommendSellPrice. Sell-now uses it. */
  grade?: string;
  requiresConfirm: boolean;
}

function round1(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 10) / 10;
}

function project(shipment: Shipment, tempC: number, rh: number, voc: number): {
  lifeHours: number;
  arrivalQuality: number;
  rupees: number;
} {
  const profile = getProduce(shipment.produce);
  const snap = degradationSnapshot(shipment.batch, profile, tempC, rh, voc);
  const travel = remainingTravelHours(shipment);
  const loss = snap.qualityLossPerHour * travel;
  const arrivalQuality = Math.min(100, Math.max(0, shipment.batch.quality - loss));
  const quote = recommendSellPrice({ produce: shipment.produce, qualityPct: arrivalQuality });
  return {
    lifeHours: snap.remainingHours,
    arrivalQuality,
    rupees: quote.recommendedRs,
  };
}

function lifeText(hours: number): string {
  if (!Number.isFinite(hours)) return "stable";
  return `${round1(hours)} h`;
}

export function planHubHold(
  world: CopilotWorld,
  shipmentId: string,
  hubId?: string
): { hubId: string; hubName: string; edgeIds: string[]; holdingTempC: number } | { error: string } {
  const shipment = world.shipments.find((s) => s.id === shipmentId);
  if (!shipment || shipment.status !== "in-transit" || shipment.route.length === 0) {
    return { error: "That truck is not in transit." };
  }
  const fromId = getEdge(shipment.route[shipment.legIndex]).from;
  const hubs = CHENNAI_NODES.filter((n) => n.type === "hub" && n.id !== shipment.destinationId);
  const chosen = hubId ? hubs.find((h) => h.id === hubId) : null;
  let best: { hubId: string; hubName: string; edgeIds: string[]; holdingTempC: number; dist: number } | null =
    null;
  const candidates = chosen ? [chosen] : hubs;
  for (const hub of candidates) {
    const edgeIds = planRoute(fromId, hub.id, {
      closedEdgeIds: world.closedEdgeIds,
      hourOfDay: world.hourOfDay,
    });
    if (!edgeIds || edgeIds.length === 0) continue;
    const holdingTempC = nodeHoldingTempC(hub, world.hourOfDay, world.scenarioOffsetC);
    const dist = edgeIds.length;
    if (!best || dist < best.dist) {
      best = { hubId: hub.id, hubName: hub.name, edgeIds, holdingTempC, dist };
    }
  }
  if (!best) return { error: "No open road to a cold hub." };
  return {
    hubId: best.hubId,
    hubName: best.hubName,
    edgeIds: best.edgeIds,
    holdingTempC: best.holdingTempC,
  };
}

export function planKitchenDivert(
  world: CopilotWorld,
  shipmentId: string
): { kitchenId: string; kitchenName: string; edgeIds: string[] } | { error: string } {
  const shipment = world.shipments.find((s) => s.id === shipmentId);
  if (!shipment || shipment.status !== "in-transit" || shipment.route.length === 0) {
    return { error: "That truck is not in transit." };
  }
  const fromId = getEdge(shipment.route[shipment.legIndex]).from;
  const kitchens = CHENNAI_NODES.filter(
    (n) =>
      n.type === "community_kitchen" &&
      (n.acceptedQualityMin == null || shipment.batch.quality >= n.acceptedQualityMin)
  );
  let best: { kitchenId: string; kitchenName: string; edgeIds: string[]; dist: number } | null = null;
  for (const kitchen of kitchens) {
    const edgeIds = planRoute(fromId, kitchen.id, {
      closedEdgeIds: world.closedEdgeIds,
      hourOfDay: world.hourOfDay,
    });
    if (!edgeIds || edgeIds.length === 0) continue;
    if (!best || edgeIds.length < best.dist) {
      best = { kitchenId: kitchen.id, kitchenName: kitchen.name, edgeIds, dist: edgeIds.length };
    }
  }
  if (!best) return { error: "No kitchen will take this load." };
  return { kitchenId: best.kitchenId, kitchenName: best.kitchenName, edgeIds: best.edgeIds };
}

export function proposeActions(world: CopilotWorld, shipmentId: string): ActionCard[] {
  const shipment = world.shipments.find((s) => s.id === shipmentId);
  if (!shipment || shipment.status !== "in-transit") return [];
  const reading = cargoReading(world, shipment);
  const now = recommendSellPrice({ produce: shipment.produce, qualityPct: shipment.batch.quality });
  const onward = project(shipment, reading.tempC, reading.rh, reading.voc);
  const profile = getProduce(shipment.produce);
  const cards: ActionCard[] = [
    {
      id: `${shipment.id}-sell-now`,
      kind: "sell-now",
      shipmentId: shipment.id,
      title: `Sell now · ₹${now.recommendedRs}`,
      detail: `${profile.label} is grade ${now.grade} at ${round1(shipment.batch.quality)}% quality. Sell-now price is ₹${now.recommendedRs} (list ₹${now.basePriceRs}). This does not move the truck.`,
      rupees: now.recommendedRs,
      lifeHours: null,
      tempC: reading.tempC,
      grade: now.grade,
      requiresConfirm: true,
    },
    {
      id: `${shipment.id}-keep`,
      kind: "keep-driving",
      shipmentId: shipment.id,
      title: `Keep driving · arrive near ₹${onward.rupees}`,
      detail: `At the ${reading.source === "probe" ? "cart probe" : "simulated sensor"} ${round1(reading.tempC)}°C, about ${lifeText(onward.lifeHours)} of life remains. Arrival quality about ${round1(onward.arrivalQuality)}%, worth about ₹${onward.rupees}.`,
      rupees: onward.rupees,
      lifeHours: Number.isFinite(onward.lifeHours) ? onward.lifeHours : null,
      tempC: reading.tempC,
      requiresConfirm: false,
    },
  ];

  const withoutCart = unprobedCargoC(world, shipment);
  if (reading.source === "probe" && Math.abs(withoutCart - reading.tempC) >= 1) {
    const city = project(shipment, withoutCart, shipment.lastRH, shipment.lastVOC);
    const where =
      shipment.transportSetpointC != null ? "reefer setpoint" : "city route temperature";
    cards.push({
      id: `${shipment.id}-city-counterfactual`,
      kind: "keep-driving",
      shipmentId: shipment.id,
      title: `If the cart were off · ₹${city.rupees}`,
      detail: `Without the cart this truck would be at the ${where} ${round1(withoutCart)}°C. Life left would be about ${lifeText(city.lifeHours)} and the arrival price about ₹${city.rupees}. The probe path above is the one in use.`,
      rupees: city.rupees,
      lifeHours: Number.isFinite(city.lifeHours) ? city.lifeHours : null,
      tempC: withoutCart,
      requiresConfirm: false,
    });
  }

  const hub = planHubHold(world, shipment.id);
  if (!("error" in hub)) {
    const heldLife = predictedShelfLifeHours(shipment.batch, profile, hub.holdingTempC);
    const heldQuote = recommendSellPrice({ produce: shipment.produce, qualityPct: shipment.batch.quality });
    cards.push({
      id: `${shipment.id}-hold`,
      kind: "hold-hub",
      shipmentId: shipment.id,
      title: `Hold at ${hub.hubName} · ₹${heldQuote.recommendedRs}`,
      detail: `Divert to ${hub.hubName} (${getNode(hub.hubId).name}), holding near ${round1(hub.holdingTempC)}°C. Life left becomes about ${lifeText(heldLife)}. Price stays ₹${heldQuote.recommendedRs} until it degrades. Storage is ₹${HUB_FEE_PER_HOUR_RUPEES}/h once the truck parks. The original destination is kept so the delivery can resume.`,
      rupees: heldQuote.recommendedRs,
      lifeHours: Number.isFinite(heldLife) ? heldLife : null,
      tempC: hub.holdingTempC,
      hubId: hub.hubId,
      requiresConfirm: true,
    });
  }

  const kitchen = planKitchenDivert(world, shipment.id);
  if (!("error" in kitchen) && shipment.batch.quality < 80) {
    cards.push({
      id: `${shipment.id}-kitchen`,
      kind: "divert-kitchen",
      shipmentId: shipment.id,
      title: `Divert to ${kitchen.kitchenName}`,
      detail: `Quality is ${round1(shipment.batch.quality)}%. ${kitchen.kitchenName} can take it. Sell-now price if you keep it in trade is ₹${now.recommendedRs}.`,
      rupees: now.recommendedRs,
      lifeHours: null,
      tempC: reading.tempC,
      kitchenId: kitchen.kitchenId,
      requiresConfirm: true,
    });
  }

  return cards;
}
