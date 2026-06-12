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
import RouteSelectionModal from "./RouteSelectionModal";
import DecisionDialog from "@/components/academy/DecisionDialog";
import WeatherWidget from "./WeatherWidget";
import TrackingCard from "./TrackingCard";

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
      <div className="absolute left-6 top-6 bottom-6 z-20 flex flex-col justify-between gap-4 pointer-events-none w-72">
        <SimControls />
        <MapLegend />
      </div>

      <div className="absolute right-6 top-6 z-10 flex flex-col gap-4 pointer-events-none">
        <div className="pointer-events-auto">
          <CityClock />
        </div>
        <div className="pointer-events-auto">
          <WeatherWidget />
        </div>
        <div className="pointer-events-auto">
          <ShipmentPanel />
        </div>
      </div>

      <CopilotPanel />
      <DemoMode />
      <ShipmentDecayModal />
      <DecisionDialog />
      <RouteSelectionModal />
      <TrackingCard />
    </div>
  );
}

