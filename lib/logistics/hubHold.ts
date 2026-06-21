/**
 * Cold-hub hold/resume + fees (pure, deterministic). When a vehicle is diverted
 * to a cold hub its delivery is left INCOMPLETE: it parks at the hub, accrues a
 * storage fee for the time it sits there, and can be resumed from the hub to its
 * original destination later. This module owns the fee math and the held-record
 * shape; the store drives the lifecycle. The patented engine is untouched.
 */

import type { ProduceId } from "../engine/types";
import type { Shipment } from "../engine/simulation";

/** Refrigerated-bay storage fee charged to a parked vehicle, ₹ per sim-hour. */
export const HUB_FEE_PER_HOUR_RUPEES = 250;

export interface HeldShipment {
  shipmentId: string;
  produce: ProduceId;
  hubId: string;
  hubName: string;
  /** Where the load was ultimately headed before it was diverted. */
  originalDestId: string;
  originalDestName: string;
  /** Cargo quality (%) at the moment it was parked. */
  qualityAtHold: number;
  /** sim clockHours when the truck reached the hub; null = still driving there. */
  arrivedClockHours: number | null;
  /** Frozen shipment for resume; null until the truck actually arrives. */
  snapshot: Shipment | null;
}

/** Hours a load has been parked at the hub (0 while still en route). */
export function heldHours(held: HeldShipment, nowClockHours: number): number {
  if (held.arrivedClockHours == null) return 0;
  return Math.max(0, nowClockHours - held.arrivedClockHours);
}

/** Storage fee (₹) for a given number of hours parked. */
export function hubFeeRupees(hoursHeld: number): number {
  return Math.max(0, hoursHeld) * HUB_FEE_PER_HOUR_RUPEES;
}

/** Storage fee (₹) accrued so far for one held load. */
export function heldFeeRupees(held: HeldShipment, nowClockHours: number): number {
  return hubFeeRupees(heldHours(held, nowClockHours));
}

/**
 * Total hub fees = already-banked fees from resumed loads + fees currently
 * accruing on loads still parked.
 */
export function totalHubFeesRupees(
  held: HeldShipment[],
  paidRupees: number,
  nowClockHours: number
): number {
  return paidRupees + held.reduce((sum, h) => sum + heldFeeRupees(h, nowClockHours), 0);
}
