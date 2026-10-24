/**
 * Allowlisted read tools. Each one calls the spoilage engine, the forecast,
 * or the ledger check. There is no SQL, shell, or open HTTP tool.
 */

import { getProduce } from "../engine/produce";
import { degradationSnapshot, predictedShelfLifeHours } from "../engine/spoilage";
import { proposeActions } from "./actions";
import { forecastSeries } from "./forecast";
import { briefingFrom, computeInsights } from "./insights";
import { searchKnowledge } from "./knowledge";
import { cargoReading, type CopilotWorld } from "./world";

export const TOOL_NAMES = [
  "get_fleet_overview",
  "list_shipments",
  "get_shipment",
  "get_device",
  "compute_freshness",
  "forecast",
  "explain_risk",
  "verify_integrity",
  "compare",
  "propose_actions",
  "search_knowledge",
  "get_briefing",
] as const;

export function getFleetOverview(world: CopilotWorld) {
  const insights = computeInsights(world);
  const moving = world.shipments.filter((s) => s.status === "in-transit");
  return {
    inTransit: moving.map((s) => s.id),
    briefing: briefingFrom(insights),
    critical: insights.filter((i) => i.severity === "critical").length,
  };
}

export function listShipments(world: CopilotWorld, status?: string) {
  return world.shipments
    .filter((s) => !status || s.status === status)
    .map((s) => ({ id: s.id, produce: s.produce, status: s.status, destinationId: s.destinationId }));
}

export function getShipment(world: CopilotWorld, id: string) {
  const shipment = world.shipments.find((s) => s.id === id);
  if (!shipment) return { error: "No shipment with that id." };
  const reading = cargoReading(world, shipment);
  return {
    id: shipment.id,
    produce: shipment.produce,
    status: shipment.status,
    tempC: reading.tempC,
    source: reading.source,
    quality: shipment.batch.quality,
    destinationId: shipment.destinationId,
  };
}

export function getDevice(world: CopilotWorld) {
  if (!world.probe) return { device: null, detail: "No live cart in this snapshot. The fleet is using simulated sensors." };
  return {
    device: "ppsc-cart",
    shipmentId: world.probe.shipmentId,
    tempC: world.probe.tempC,
    stale: world.probe.stale,
    ageS: world.probe.ageS,
  };
}

export function computeFreshness(world: CopilotWorld, shipmentId: string, whatIf?: { tempC: number; hours: number }) {
  const shipment = world.shipments.find((s) => s.id === shipmentId);
  if (!shipment) return { error: "No shipment with that id." };
  const profile = getProduce(shipment.produce);
  const reading = cargoReading(world, shipment);
  const tempC = whatIf?.tempC ?? reading.tempC;
  const snap = degradationSnapshot(shipment.batch, profile, tempC, reading.rh, reading.voc);
  const life = predictedShelfLifeHours(shipment.batch, profile, tempC);
  const loss = whatIf ? snap.qualityLossPerHour * whatIf.hours : null;
  return {
    shipmentId,
    tempC,
    source: whatIf ? "what-if" : reading.source,
    lifeHours: Number.isFinite(life) ? life : null,
    rate: snap.rate,
    qualityLoss: loss,
  };
}

export function forecast(world: CopilotWorld, shipmentId: string) {
  const series = world.recentTemps[shipmentId] ?? [];
  const result = forecastSeries(series, 1);
  if (!result) return { shipmentId, forecast: null, detail: "Fewer than 4 temperature samples." };
  return { shipmentId, ...result };
}

export function explainRisk(world: CopilotWorld, shipmentId: string) {
  return computeInsights(world).filter((i) => i.entityId === shipmentId);
}

export function verifyIntegrity(world: CopilotWorld) {
  return computeInsights(world).find((i) => i.type === "integrity") ?? null;
}

export function compare(world: CopilotWorld, ids: string[]) {
  return ids.map((id) => {
    const shipment = world.shipments.find((s) => s.id === id);
    if (!shipment) return { id, error: "missing" };
    const reading = cargoReading(world, shipment);
    const life = predictedShelfLifeHours(shipment.batch, getProduce(shipment.produce), reading.tempC);
    return { id, tempC: reading.tempC, source: reading.source, lifeHours: Number.isFinite(life) ? life : null };
  });
}

export function propose(world: CopilotWorld, shipmentId: string) {
  return proposeActions(world, shipmentId).map((card) => ({
    id: card.id,
    kind: card.kind,
    title: card.title,
    rupees: card.rupees,
    hubId: card.hubId ?? null,
    requiresConfirm: card.requiresConfirm,
  }));
}

export function search(query: string) {
  return searchKnowledge(query);
}

export function getBriefing(world: CopilotWorld) {
  return briefingFrom(computeInsights(world));
}
