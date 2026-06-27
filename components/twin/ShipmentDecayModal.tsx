"use client";

/**
 * Opens a modal for the shipment the operator clicked on the Twin. A SPOILED
 * load shows the causal "Understand why" chain (the learning moment); a healthy
 * one shows its decay curve.
 */

import dynamic from "next/dynamic";
import { useColdgridStore } from "@/store/coldgridStore";
import { getProduce } from "@/lib/engine/produce";
import { buildCausalChain } from "@/lib/academy/causal";
import CausalModal from "@/components/academy/CausalModal";

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

  const close = () => setSelectedShipment(null);

  if (ship.batch.quality <= 0) {
    return (
      <CausalModal
        chain={buildCausalChain({
          produce: ship.produce,
          reefer: ship.transportSetpointC != null,
          setpointC: ship.transportSetpointC,
          history: ship.batch.history,
          finalQuality: ship.batch.quality,
          spoiled: true,
        })}
        onClose={close}
      />
    );
  }

  return (
    <DecayCurveModal
      history={ship.batch.history}
      produce={ship.produce}
      title={`${getProduce(ship.produce).label} ${ship.id}`}
      onClose={close}
    />
  );
}
