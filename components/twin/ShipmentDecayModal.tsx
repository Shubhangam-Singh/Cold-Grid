"use client";

/** Opens the decay-curve modal for the shipment the operator clicked on the Twin. */

import dynamic from "next/dynamic";
import { useColdgridStore } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";

// Lazy — pulls in recharts only when a decay curve is actually opened.
const DecayCurveModal = dynamic(() => import("@/components/dashboard/DecayCurveModal"), {
  ssr: false,
});

export default function ShipmentDecayModal() {
  const selectedShipmentId = useColdgridStore((s) => s.selectedShipmentId);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);

  const ship = shipments.find((s) => s.id === selectedShipmentId);
  if (!ship) return null;

  return (
    <DecayCurveModal
      history={ship.batch.history}
      produce={ship.produce}
      title={`${getProduce(ship.produce).label} ${ship.id}`}
      onClose={() => setSelectedShipment(null)}
    />
  );
}
