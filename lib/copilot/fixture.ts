/** Fixed fleet used by the golden questions. Simulated, not a live cart. */

import { createSimulation, dispatchShipment } from "../engine/simulation";
import { worldFromSim, type CopilotWorld } from "./world";

export function demoWorld(): CopilotWorld {
  let sim = createSimulation(1, { startHourOfDay: 9 });
  sim = dispatchShipment(sim, { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" });
  const id = sim.shipments[0].id;
  return worldFromSim(sim, {
    probe: { shipmentId: id, tempC: 24.6, rh: 75, voc: 246, ageS: 1, stale: false },
    recentTemps: { [id]: [22, 22.5, 23, 23.4, 23.8, 24.1, 24.4, 24.6] },
  });
}
