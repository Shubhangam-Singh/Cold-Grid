"use client";

/**
 * The Twin map (Phase 3): a free, no-API-key Carto dark basemap (RULE 3) with
 * deck.gl overlays — the Chennai road network, and the city's food-infrastructure
 * nodes drawn as rings whose color encodes live holding temperature.
 *
 * No shipment movement yet (that is Phase 4) — static nodes on a control-room map.
 */

import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  type CityEdge,
  type CityNode,
  getNode,
  nodeHoldingTempC,
} from "@/lib/city/chennai";
import {
  createBatch,
  predictedShelfLifeHours,
} from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";
import { useColdgridStore } from "@/store/coldgridStore";
import { NODE_TYPE_STYLE, rgbCss, tempToRgb } from "./colors";

// Free, no-key dark basemap (Carto dark-matter). RULE 3.
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

function tooltipHtml(node: CityNode, tempC: number): string {
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
    produceBlock = `
      <div style="margin-top:6px;color:#94a3b8">Handles: ${node.handles
        .map((h) => getProduce(h).label)
        .join(", ")}</div>
      <div style="margin-top:2px">${profile.label} fresh life @ <span style="font-family:${MONO};color:${tempColor}">${tempC.toFixed(
        1
      )}°C</span>: <span style="font-family:${MONO}">~${pred.toFixed(0)} h</span></div>`;
  }

  return `
    <div style="font-weight:600;font-size:13px">${style.glyph} ${node.name}</div>
    <div style="text-transform:uppercase;letter-spacing:0.08em;font-size:10px;color:#64748b;margin-top:2px">${node.type}</div>
    <div style="margin-top:6px">Holding temp: <span style="font-family:${MONO};color:${tempColor};font-weight:600">${tempC.toFixed(
      1
    )}°C</span></div>
    <div style="color:#94a3b8;font-size:11px">${fridge}</div>
    ${produceBlock}
    <div style="margin-top:6px;color:#64748b;font-size:11px;line-height:1.35">${node.description}</div>`;
}

export default function DeckMap() {
  const nodes = useColdgridStore((s) => s.nodes);
  const edges = useColdgridStore((s) => s.edges);
  const hourOfDay = useColdgridStore((s) => s.hourOfDay);
  const scenarioOffsetC = useColdgridStore((s) => s.scenarioOffsetC);
  const hoveredNodeId = useColdgridStore((s) => s.hoveredNodeId);
  const selectedNodeId = useColdgridStore((s) => s.selectedNodeId);
  const setHoveredNode = useColdgridStore((s) => s.setHoveredNode);
  const setSelectedNode = useColdgridStore((s) => s.setSelectedNode);

  const tempOf = (node: CityNode) =>
    nodeHoldingTempC(node, hourOfDay, scenarioOffsetC);

  const layers = useMemo(() => {
    const edgeLayer = new LineLayer<CityEdge>({
      id: "edges",
      data: edges,
      getSourcePosition: (e) => getNode(e.from).coordinates,
      getTargetPosition: (e) => getNode(e.to).coordinates,
      getColor: (e) => (e.floodProne ? [120, 83, 28, 200] : [51, 65, 85, 160]),
      getWidth: 1.5,
      widthUnits: "pixels",
      pickable: false,
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

    return [edgeLayer, nodeLayer, labelLayer];
    // tempOf closes over hourOfDay/scenarioOffsetC; listed below so layers rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodes,
    edges,
    hourOfDay,
    scenarioOffsetC,
    hoveredNodeId,
    selectedNodeId,
    setHoveredNode,
    setSelectedNode,
  ]);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
      getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      getTooltip={(info: PickingInfo<CityNode>) => {
        if (!info.object) return null;
        return {
          html: tooltipHtml(info.object, tempOf(info.object)),
          style: {
            backgroundColor: "rgba(2,6,23,0.96)",
            color: "#e2e8f0",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            padding: "10px 12px",
            fontSize: "12px",
            fontFamily: "var(--font-sans), sans-serif",
            maxWidth: "260px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
          },
        };
      }}
    >
      <Map reuseMaps mapStyle={CARTO_DARK} />
    </DeckGL>
  );
}
