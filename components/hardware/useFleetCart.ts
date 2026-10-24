"use client";

import { useEffect, useState } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { useLiveHardwareStore } from "@/store/liveHardwareStore";
import { cartOverlayFor, cartTargetId, type CartOverlay } from "@/lib/hardware/fleetOverlay";

/** The cart overlay for one shipment, or null when this truck stays synthetic. */
export function useFleetCart(shipmentId: string): CartOverlay | null {
  const attach = useLiveHardwareStore((s) => s.attachToFleet);
  const listen = useLiveHardwareStore((s) => s.listen);
  const connected = useLiveHardwareStore((s) => s.connected);
  const session = useLiveHardwareStore((s) => s.session);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!listen) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [listen]);

  const shipment = shipments.find((s) => s.id === shipmentId);
  if (!shipment) return null;
  // `tick` forces a re-render so a paused sim still drops a stale frame.
  void tick;
  return cartOverlayFor(shipment, {
    listen,
    connected,
    session,
    nowMs: Date.now(),
    candidateId: cartTargetId(shipments, attach),
    truckBatch: shipment.batch,
  });
}
