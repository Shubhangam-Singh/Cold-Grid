"use client";

/**
 * The Twin map (Phase 4): the Chennai network + nodes (rings colored by holding
 * temperature) plus LIVE shipments — deck.gl arcs along their route and a moving
 * marker colored by the engine's live quality, all on a free no-key Carto dark
 * basemap (RULE 3).
 */

import { useMemo, useState, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Color, PickingInfo } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  type CityEdge,
  type CityNode,
  edgePath,
  getEdge,
  getNode,
  nodeHoldingTempC,
} from "@/lib/city/chennai";
import {
  baseRate,
  celsiusToKelvin,
  createBatch,
  predictedShelfLifeHours,
} from "@/lib/engine/spoilage";
import type { Shipment } from "@/lib/engine/simulation";
import { getProduce } from "@/lib/engine/produce";
import { useColdgridStore } from "@/store/coldgridStore";
import { NODE_TYPE_STYLE, qualityToRgb, rgbCss, tempToRgb } from "./colors";

const CARTO_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW_STATE = {
  longitude: 80.237,
  latitude: 13.062,
  zoom: 10.9,
  pitch: 0,
  bearing: 0,
};

const MONO = "var(--font-mono), monospace";

interface RouteDatum {
  path: [number, number][];
  timestamps: number[];
  quality: number;
  active: boolean;
}

interface RiskPoint {
  position: [number, number];
  weight: number;
}

// Spoilage-risk heatmap ramp (low → high): green → amber → red.
const RISK_COLORS: Color[] = [
  [26, 152, 80],
  [145, 207, 96],
  [217, 239, 139],
  [254, 224, 139],
  [252, 141, 89],
  [215, 48, 39],
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Spoilage-risk weight of a node: the engine's dimensionless degradation rate
 * for its representative produce at its current holding temperature, normalized.
 * Refrigerated hubs read ~0; hot unrefrigerated nodes read high.
 */
function nodeRisk(node: CityNode, hourOfDay: number, scenarioOffsetC: number): number {
  const pid = node.handles && node.handles.length > 0 ? node.handles[0] : "milk";
  const profile = getProduce(pid);
  const tempC = nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);
  const rate = baseRate(celsiusToKelvin(tempC), profile.eaBase, profile);
  return clamp01((rate - 0.5) / 6);
}

function nodeTooltipHtml(node: CityNode, tempC: number): string {
  const style = NODE_TYPE_STYLE[node.type];
  const tempColor = rgbCss(tempToRgb(tempC));
  const fridge = node.refrigeration
    ? `Refrigerated · setpoint ${node.refrigeration.setpointC.toFixed(0)}°C`
    : "Unrefrigerated · tracks ambient";
  let produceBlock = "";
  if (node.handles && node.handles.length > 0) {
    const pid = node.handles[0];
    const profile = getProduce(pid);
    const pred = predictedShelfLifeHours(createBatch("hover", pid), profile, tempC);
    produceBlock = `<div style="margin-top:6px;color:#94a3b8">Handles: ${node.handles
      .map((h) => getProduce(h).label)
      .join(", ")}</div>
      <div style="margin-top:2px">${profile.label} fresh life @ <span style="font-family:${MONO};color:${tempColor}">${tempC.toFixed(
        1
      )}°C</span>: <span style="font-family:${MONO}">~${pred.toFixed(0)} h</span></div>`;
  }
  return `<div style="font-weight:600;font-size:13px">${style.glyph} ${node.name}</div>
    <div style="text-transform:uppercase;letter-spacing:0.08em;font-size:10px;color:#64748b;margin-top:2px">${node.type}</div>
    <div style="margin-top:6px">Holding temp: <span style="font-family:${MONO};color:${tempColor};font-weight:600">${tempC.toFixed(
      1
    )}°C</span></div>
    <div style="color:#94a3b8;font-size:11px">${fridge}</div>
    ${produceBlock}`;
}

function shipmentTooltipHtml(s: Shipment): string {
  const profile = getProduce(s.produce);
  const qColor = rgbCss(qualityToRgb(s.batch.quality));
  const tColor = rgbCss(tempToRgb(s.lastTempC));
  const pred = predictedShelfLifeHours(s.batch, profile, s.lastTempC);
  const spoiled = s.batch.quality <= 0;
  const transport =
    s.transportSetpointC != null
      ? `❄ Reefer @ ${s.transportSetpointC.toFixed(0)}°C`
      : "Ambient truck";
  return `<div style="font-weight:600;font-size:13px">${profile.label} shipment ${s.id}</div>
    <div style="font-size:10px;color:#64748b;margin-top:2px">${getNode(s.originId).name} → ${getNode(s.destinationId).name} · ${transport}</div>
    <div style="margin-top:6px">Quality: <span style="font-family:${MONO};color:${qColor};font-weight:600">${s.batch.quality.toFixed(
      0
    )}%</span>${spoiled ? ' <span style="color:#ef4444">⚠ SPOILED</span>' : ""}</div>
    <div>Cargo temp: <span style="font-family:${MONO};color:${tColor}">${s.lastTempC.toFixed(
      1
    )}°C</span> · RH <span style="font-family:${MONO}">${s.lastRH.toFixed(0)}%</span></div>
    <div>Est. life left @ temp: <span style="font-family:${MONO}">~${pred.toFixed(1)} h</span></div>
    <div style="color:#94a3b8;font-size:11px;margin-top:4px">Thermal breaches: ${s.batch.breachTicks} ticks</div>
    <div style="color:#38bdf8;font-size:10px;margin-top:4px">click → decay curve</div>`;
}

export default function DeckMap() {
  const nodes = useColdgridStore((s) => s.nodes);
  const edges = useColdgridStore((s) => s.edges);
  const hourOfDay = useColdgridStore((s) => s.sim.hourOfDay);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const hoveredNodeId = useColdgridStore((s) => s.hoveredNodeId);
  const selectedNodeId = useColdgridStore((s) => s.selectedNodeId);
  const setHoveredNode = useColdgridStore((s) => s.setHoveredNode);
  const setSelectedNode = useColdgridStore((s) => s.setSelectedNode);
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);
  const showHeatmap = useColdgridStore((s) => s.showHeatmap);

  // Global time loop for pulsing TripsLayer (0 to 100)
  const [time, setTime] = useState(0);
  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setTime((t) => (t + 1) % 100);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const tempOf = (node: CityNode) =>
    nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);

  const inTransit = useMemo(
    () => shipments.filter((s) => s.status === "in-transit"),
    [shipments]
  );

  const riskData = useMemo<RiskPoint[]>(() => {
    if (!showHeatmap) return [];
    const points: RiskPoint[] = nodes
      .map((n) => ({ position: n.coordinates, weight: nodeRisk(n, hourOfDay, scenarioOffsetC) }))
      .filter((p) => p.weight > 0.05);
    for (const s of inTransit) {
      points.push({
        position: s.position,
        weight: clamp01(0.3 + (1 - s.batch.quality / 100) * 1.2),
      });
    }
    return points;
  }, [showHeatmap, nodes, inTransit, hourOfDay, scenarioOffsetC]);

  const routeData = useMemo<RouteDatum[]>(
    () =>
      inTransit.flatMap((s) =>
        s.route.map((edgeId, i) => {
          const path = edgePath(getEdge(edgeId));
          const timestamps = path.map((_, idx) => (idx / Math.max(1, path.length - 1)) * 100);
          return {
            path,
            timestamps,
            quality: s.batch.quality,
            active: i === s.legIndex,
          };
        })
      ),
    [inTransit]
  );

  const layers = useMemo(() => {
    const heatLayer = new HeatmapLayer<RiskPoint>({
      id: "risk-heat",
      data: riskData,
      getPosition: (d) => d.position,
      getWeight: (d) => d.weight,
      radiusPixels: 75,
      intensity: 1.1,
      threshold: 0.05,
      colorRange: RISK_COLORS,
      aggregation: "SUM",
      pickable: false,
    });

    const roadLayer = new PathLayer<CityEdge>({
      id: "roads",
      data: edges,
      getPath: (e) => edgePath(e),
      getColor: (e) => (e.floodProne ? [120, 83, 28, 200] : [51, 65, 85, 150]),
      getWidth: 1.6,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: false,
    });

    const routeHighlight = new PathLayer<RouteDatum>({
      id: "route-paths",
      data: routeData,
      getPath: (d) => d.path,
      getColor: (d) => [...qualityToRgb(d.quality), d.active ? 235 : 90],
      getWidth: (d) => (d.active ? 3.5 : 1.8),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: false,
    });

    const routeTrips = new TripsLayer<RouteDatum>({
      id: "route-trips",
      data: routeData.filter((d) => d.active),
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => qualityToRgb(d.quality),
      opacity: 1.0,
      widthMinPixels: 4,
      trailLength: 40,
      currentTime: time,
      capRounded: true,
      jointRounded: true,
      updateTriggers: {
        getColor: [routeData],
      },
    });

    const nodeLayer = new ScatterplotLayer<CityNode>({
      id: "nodes",
      data: nodes,
      getPosition: (n) => n.coordinates,
      radiusUnits: "pixels",
      getRadius: (n) => NODE_TYPE_STYLE[n.type].radiusPx,
      stroked: true,
      filled: true,
      getFillColor: (n) => {
        const f = NODE_TYPE_STYLE[n.type].fill;
        return [f[0], f[1], f[2], 230];
      },
      getLineColor: (n) => tempToRgb(tempOf(n)),
      lineWidthUnits: "pixels",
      getLineWidth: (n) =>
        n.id === selectedNodeId ? 5 : n.id === hoveredNodeId ? 4 : 2.5,
      radiusMinPixels: 4,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 40],
      onHover: (info: PickingInfo<CityNode>) =>
        setHoveredNode(info.object ? info.object.id : null),
      onClick: (info: PickingInfo<CityNode>) =>
        setSelectedNode(info.object ? info.object.id : null),
      updateTriggers: {
        getLineColor: [hourOfDay, scenarioOffsetC],
        getLineWidth: [hoveredNodeId, selectedNodeId],
      },
    });

    const shipmentHalo = new ScatterplotLayer<Shipment>({
      id: "shipment-halo",
      data: inTransit,
      getPosition: (s) => s.position,
      radiusUnits: "pixels",
      getRadius: 16,
      getFillColor: (s) => [...qualityToRgb(s.batch.quality), 55],
      pickable: false,
    });

    const shipmentLayer = new ScatterplotLayer<Shipment>({
      id: "shipments",
      data: inTransit,
      getPosition: (s) => s.position,
      radiusUnits: "pixels",
      getRadius: 7,
      stroked: true,
      filled: true,
      getFillColor: (s) => qualityToRgb(s.batch.quality),
      getLineColor: [226, 232, 240],
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      onClick: (info: PickingInfo<Shipment>) =>
        setSelectedShipment(info.object ? info.object.id : null),
      updateTriggers: { getFillColor: [inTransit] },
    });

    const labelLayer = new TextLayer<CityNode>({
      id: "labels",
      data: nodes,
      getPosition: (n) => n.coordinates,
      getText: (n) => n.name,
      getColor: [226, 232, 240, 235],
      getSize: 11,
      sizeUnits: "pixels",
      fontFamily: "monospace",
      fontWeight: 500,
      getTextAnchor: "middle",
      getAlignmentBaseline: "top",
      getPixelOffset: (n) => [0, NODE_TYPE_STYLE[n.type].radiusPx + 6],
      background: true,
      getBackgroundColor: [2, 6, 23, 190],
      backgroundPadding: [5, 3],
      pickable: false,
    });

    const base = [roadLayer, routeHighlight, routeTrips, shipmentHalo, nodeLayer, shipmentLayer, labelLayer];
    return showHeatmap ? [heatLayer, ...base] : base;
    // tempOf closes over hourOfDay/scenarioOffsetC; listed below so layers rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodes,
    edges,
    routeData,
    riskData,
    showHeatmap,
    inTransit,
    hourOfDay,
    scenarioOffsetC,
    hoveredNodeId,
    selectedNodeId,
    setHoveredNode,
    setSelectedNode,
    setSelectedShipment,
    time,
  ]);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
      getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      getTooltip={(info: PickingInfo) => {
        if (!info.object) return null;
        const layerId = info.layer?.id;
        let html: string | null = null;
        if (layerId === "nodes") {
          const node = info.object as CityNode;
          html = nodeTooltipHtml(node, tempOf(node));
        } else if (layerId === "shipments") {
          html = shipmentTooltipHtml(info.object as Shipment);
        }
        if (!html) return null;
        return {
          html,
          style: {
            backgroundColor: "rgba(2,6,23,0.96)",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            fontFamily: "var(--font-sans), sans-serif",
            maxWidth: "270px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
          },
        };
      }}
    >
      <Map reuseMaps mapStyle={CARTO_DARK} />
    </DeckGL>
  );
}
