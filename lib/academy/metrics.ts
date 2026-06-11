/**
 * Live fleet metrics derived from the current shipments (pure). Powers the
 * dashboard MetricsBar on the Twin.
 */

import { routeDistanceKm } from "../city/chennai";
import type { Shipment } from "../engine/simulation";
import { CO2_PER_KM, CO2_PER_KWH, COST_PER_KM, COST_PER_KWH } from "./scoring";

export interface FleetMetrics {
  total: number;
  inTransit: number;
  delivered: number;
  spoiled: number;
  /** Average quality of delivered shipments (null if none delivered yet). */
  foodSavedPct: number | null;
  energyKwh: number;
  co2Kg: number;
  costRupees: number;
  /** 0–100 reputation: clean slate until deliveries land, then tracks food saved. */
  reputation: number;
}

export function fleetMetrics(shipments: Shipment[]): FleetMetrics {
  const delivered = shipments.filter((s) => s.status === "delivered");
  const inTransit = shipments.filter((s) => s.status === "in-transit");
  const spoiled = shipments.filter((s) => s.batch.quality <= 0).length;

  const energyKwh = shipments.reduce((sum, s) => sum + s.energyKwh, 0);
  const distanceKm = shipments.reduce((sum, s) => sum + routeDistanceKm(s.route), 0);

  const foodSavedPct =
    delivered.length > 0
      ? delivered.reduce((sum, s) => sum + s.batch.quality, 0) / delivered.length
      : null;

  return {
    total: shipments.length,
    inTransit: inTransit.length,
    delivered: delivered.length,
    spoiled,
    foodSavedPct,
    energyKwh,
    co2Kg: energyKwh * CO2_PER_KWH + distanceKm * CO2_PER_KM,
    costRupees: energyKwh * COST_PER_KWH + distanceKm * COST_PER_KM,
    reputation: foodSavedPct ?? 100,
  };
}
