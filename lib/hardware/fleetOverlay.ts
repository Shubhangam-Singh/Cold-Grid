/**
 * One physical cart drives one in-transit truck.
 *
 * While Real PPSC readings are on and the frame is fresh, that truck's
 * cargo temperature, humidity, and gas come from the probe. City ambient
 * stays on the clock. The truck keeps its own produce and batch, so a
 * tomato run does not inherit the bench's fish price.
 *
 * "Drive Kasimedu fish truck" pins the probe to that fish truck when one
 * is in transit. Otherwise the newest in-transit truck gets the probe.
 * A stale frame (or the toggle off) drops the overlay and the sim feed.
 */

import type { Batch } from "../engine/types";
import { benchMode, type LiveSession } from "./liveSession";
import type { SensorReading } from "./types";

export interface FleetShipmentRef {
  id: string;
  originId: string;
  produce: string;
  status: string;
}

export interface CartOverlay {
  tempC: number;
  rh: number;
  voc: number;
  quality: number;
  batch: Batch;
}

export interface CargoSensorSample {
  T_C: number;
  RH: number;
  VOC: number;
}

export function newestInTransitId(shipments: FleetShipmentRef[]): string | null {
  const matches = shipments.filter((s) => s.status === "in-transit");
  return matches.length > 0 ? matches[matches.length - 1].id : null;
}

export function newestKasimeduFishId(shipments: FleetShipmentRef[]): string | null {
  const matches = shipments.filter(
    (s) => s.status === "in-transit" && s.originId === "kasimedu" && s.produce === "fish"
  );
  return matches.length > 0 ? matches[matches.length - 1].id : null;
}

/** The single truck whose cargo sensors follow the cart. */
export function cartTargetId(shipments: FleetShipmentRef[], attachFish: boolean): string | null {
  if (attachFish) {
    const pinned = newestKasimeduFishId(shipments);
    if (pinned) return pinned;
  }
  return newestInTransitId(shipments);
}

function freshReading(args: {
  listen: boolean;
  connected: boolean;
  session: LiveSession;
  nowMs: number;
}): SensorReading | null {
  if (!args.listen || args.session.reading == null) return null;
  const mode = benchMode({
    listen: args.listen,
    connected: args.connected,
    reading: args.session.reading,
    nowMs: args.nowMs,
  });
  if (mode !== "live") return null;
  return args.session.reading;
}

export function cartOverlayFor(
  shipment: FleetShipmentRef,
  args: {
    listen: boolean;
    connected: boolean;
    session: LiveSession;
    nowMs: number;
    candidateId: string | null;
    /** The truck's own batch. Quality and sell price stay on this produce. */
    truckBatch: Batch | null;
  }
): CartOverlay | null {
  const reading = freshReading(args);
  if (!reading) return null;
  if (args.candidateId == null || shipment.id !== args.candidateId) return null;
  if (args.truckBatch == null) return null;

  return {
    tempC: reading.tempC,
    rh: reading.humidity,
    voc: reading.gas,
    quality: args.truckBatch.quality,
    batch: args.truckBatch,
  };
}

/**
 * Sensor map for one simulation tick. Undefined when the cart is off or
 * the frame is stale, so the synthetic path stays unchanged.
 */
export function liveCargoSensors(args: {
  listen: boolean;
  connected: boolean;
  session: LiveSession;
  nowMs: number;
  shipments: FleetShipmentRef[];
  attachFish: boolean;
}): Record<string, CargoSensorSample> | undefined {
  const reading = freshReading(args);
  if (!reading) return undefined;
  const id = cartTargetId(args.shipments, args.attachFish);
  if (!id) return undefined;
  return { [id]: { T_C: reading.tempC, RH: reading.humidity, VOC: reading.gas } };
}
