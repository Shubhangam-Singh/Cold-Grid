import { ScatterplotLayer } from "@deck.gl/layers";
import type { CityNode } from "@/lib/city/chennai";

export function getUrbanFarmLayers(
  nodes: CityNode[],
  time: number,
  hourOfDay: number,
  scenarioOffsetC: number
) {
  // Only active in Scenario 2 (heatwave) or generally active? The user said "During Scenario 2 (Heatwave), the panel highlights in green... In Scenario 2: Urban farm nodes become 'active supply nodes'". So let's animate the pulse based on the heatwave or just show it.
  const isHeatwave = scenarioOffsetC > 0;
  
  const farms = nodes.filter((n) => n.type === "urban_farm");

  // A subtle pulsing animation based on the 0-100 time parameter (which runs at requestAnimationFrame speed, ~3s cycle if using time/100)
  const pulseScale = 1 + Math.sin((time / 100) * Math.PI * 2) * 0.15;

  return [
    new ScatterplotLayer({
      id: "urban-farm-radius-layer",
      data: farms,
      getPosition: (d: CityNode) => d.coordinates,
      // supplyRadiusKm is usually 1.5 - 3.5. ScatterplotLayer uses meters for radius when radiusUnits is 'meters'
      getRadius: (d: CityNode) => (d.supplyRadiusKm || 2) * 1000,
      radiusUnits: "meters",
      getFillColor: [34, 197, 94, isHeatwave ? 30 : 15], // #22c55e with low opacity
      getLineColor: [34, 197, 94, 150],
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      // Pulsing effect when active (during heatwave or just gently pulsing)
      radiusScale: isHeatwave ? pulseScale : 1,
      updateTriggers: {
        radiusScale: [time, isHeatwave],
        getFillColor: [isHeatwave],
      },
      transitions: {
        radiusScale: 0, // smooth continuous animation
      },
    }),
  ];
}
