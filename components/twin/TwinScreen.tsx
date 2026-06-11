"use client";

/**
 * Client shell for the Twin. The deck.gl/MapLibre map is loaded with ssr:false
 * (it touches `window`); the operator controls, city clock, shipment roster,
 * and legend overlay it. SimulationClock drives the tick loop.
 */

import dynamic from "next/dynamic";
import MapLegend from "./MapLegend";
import CityClock from "./CityClock";
import SimControls from "./SimControls";
import ShipmentPanel from "./ShipmentPanel";
import SimulationClock from "./SimulationClock";
import ShipmentDecayModal from "./ShipmentDecayModal";
import DemoMode from "./DemoMode";
import CopilotPanel from "@/components/learning/CopilotPanel";

const DeckMap = dynamic(() => import("./DeckMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#07090d]">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
        Loading Chennai twin…
      </span>
    </div>
  ),
});

export default function TwinScreen() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckMap />
      <SimulationClock />
      <SimControls />
      <div className="absolute right-6 top-6 z-10 flex flex-col gap-4 pointer-events-none">
        <div className="pointer-events-auto">
          <CityClock />
        </div>
        <div className="pointer-events-auto">
          <ShipmentPanel />
        </div>
      </div>
      <MapLegend />
      <CopilotPanel />
      <DemoMode />
      <ShipmentDecayModal />
    </div>
  );
}
