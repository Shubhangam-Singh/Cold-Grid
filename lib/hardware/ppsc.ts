/**
 * Presentation helper: every truck on the fleet map is treated as carrying a
 * PPSC unit (DHT22 + MQ-135). IDs are derived from the shipment id so the
 * engine schema stays unchanged.
 */

/** SHP-1 → PPSC-001, SHP-12 → PPSC-012. */
export function ppscUnitId(shipmentId: string): string {
  const match = shipmentId.match(/(\d+)\s*$/);
  const n = match ? Number(match[1]) : 0;
  return `PPSC-${String(Number.isFinite(n) ? n : 0).padStart(3, "0")}`;
}
