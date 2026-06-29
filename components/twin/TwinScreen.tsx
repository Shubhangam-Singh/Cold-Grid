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
import FarmImpactPanel from "./FarmImpactPanel";
import DecisionDialog from "@/components/academy/DecisionDialog";
import WeatherWidget from "./WeatherWidget";
import TrackingCard from "./TrackingCard";
import MobileControlDock from "./MobileControlDock";
import HeldShipmentsPanel from "./HeldShipmentsPanel";
import ConceptWatcher from "@/components/learning/ConceptWatcher";
import ConceptPopup from "@/components/learning/ConceptPopup";

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
      {/* Desktop side columns — hidden on phones/tablets; the MobileControlDock
          surfaces these same panels in a drawer below the lg breakpoint. */}
      <div className="absolute left-6 top-6 bottom-6 z-20 hidden lg:flex flex-col justify-between gap-4 pointer-events-none w-72">
        <SimControls />
        <MapLegend />
      </div>

      <div className="absolute right-6 top-6 bottom-10 z-10 hidden lg:flex flex-col gap-4 pointer-events-none overflow-y-auto overflow-x-hidden w-[350px] pr-2 pb-4 items-end custom-scrollbar">
        <div className="pointer-events-auto shrink-0 w-full flex justify-end">
          <CityClock />
        </div>
        <div className="pointer-events-auto shrink-0 w-full flex justify-end">
          <WeatherWidget />
        </div>
        <div className="pointer-events-auto shrink-0 w-full flex justify-end">
          <FarmImpactPanel />
        </div>
        <div className="pointer-events-auto shrink-0 w-full flex justify-end">
          <ShipmentPanel />
        </div>
        <div className="pointer-events-auto shrink-0 w-full flex justify-end">
          <HeldShipmentsPanel />
        </div>
      </div>

      <MobileControlDock />
      <CopilotPanel />
      <DemoMode />
      <ShipmentDecayModal />
      <DecisionDialog />
      <RouteSelectionModal />
      <TrackingCard />
      <ConceptWatcher />
      <ConceptPopup />
    </div>
  );
}

