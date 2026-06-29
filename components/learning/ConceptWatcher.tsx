"use client";

/**
 * Watches the live simulation and pops the right concept card at the moment it
 * becomes relevant (renders nothing). Each card fires once (the learning store
 * enforces that). Mounted on both the Twin and the Academy.
 *
 *  - cargo temp first exceeds its safe ceiling → Arrhenius
 *  - heatwave ambient first goes high           → Urban Heat Island
 *  - a reefer is first put in play              → cold vs grid tradeoff
 *  - a load first spoils                        → food miles & equity
 *  (EMA thermal memory fires on the first Academy win — see academyStore.)
 */

import { useEffect } from "react";
import { useColdgridStore } from "@/store/coldgridStore";
import { useLearningStore } from "@/store/learningStore";
import { getProduce } from "@/lib/engine/produce";
import { KELVIN } from "@/lib/engine/spoilage";

export default function ConceptWatcher() {
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const trigger = useLearningStore((s) => s.trigger);

  useEffect(() => {
    for (const s of shipments) {
      if (s.transportSetpointC != null) trigger("tradeoff");
      if (s.batch.quality <= 0) trigger("equity");
      if (s.status === "in-transit") {
        const ceilingC = getProduce(s.produce).thermalStressK - KELVIN;
        if (s.lastTempC > ceilingC) trigger("arrhenius");
      }
    }
  }, [shipments, trigger]);

  useEffect(() => {
    if (scenarioOffsetC >= 4) trigger("uhi");
  }, [scenarioOffsetC, trigger]);

  return null;
}
