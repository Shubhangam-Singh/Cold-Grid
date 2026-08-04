"use client";

/**
 * The Twin map (Phase 4): the Chennai network + nodes (rings colored by holding
 * temperature) plus LIVE shipments — deck.gl arcs along their route and a moving
 * marker colored by the engine's live quality, all on a free no-key Carto dark
 * basemap (RULE 3).
 */

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Color, PickingInfo } from "@deck.gl/core";
import { WebMercatorViewport } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import TruckMarker from "./TruckMarker";
import HeldMarker from "./HeldMarker";
import { getUrbanFarmLayers } from "./UrbanFarmLayer";

import {
  type CityEdge,
  type CityNode,
  edgePath,
  getEdge,
  getNode,
  nodeHoldingTempC,
  trafficMultiplier,
} from "@/lib/city/chennai";
import {
  baseRate,
  celsiusToKelvin,
  createBatch,
  predictedShelfLifeHours,
} from "@/lib/engine/spoilage";
import { getProduce } from "@/lib/engine/produce";
import { useColdgridStore } from "@/store/coldgridStore";
import {
  EMPTY_LABEL_LAYOUT,
  LABEL_FADE_MS,
  LABEL_FONT_SIZE_PX,
  LABEL_PADDING_X,
  LABEL_PADDING_Y,
  defaultPlacement,
  layoutLabels,
  type LabelLayout,
} from "@/lib/map/labelLayout";
import { NODE_TYPE_STYLE, qualityToRgb, rgbCss, tempToRgb } from "./colors";

const CARTO_DARK =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Regional frame: centered to take in Chennai (north) through Chengalpattu /
// Mahabalipuram (south) with Kanchipuram, Sriperumbudur, Vellore and Puducherry
// reachable by a short pan. (Was a Chennai-only 80.237/13.062 @ z10.9.)
const INITIAL_VIEW_STATE = {
  longitude: 79.95,
  latitude: 12.6,
  zoom: 8.3,
  pitch: 0,
  bearing: 0,
};

const MONO = "var(--font-mono), monospace";

/**
 * How often the label layout is recomputed while the operator pans or zooms.
 * Throttled (with a trailing pass) so labels reflow visibly during the gesture
 * without rebuilding the layer stack on every pointer event.
 */
const LABEL_RELAYOUT_MS = 60;

interface ViewSnapshot {
  longitude: number;
  latitude: number;
  zoom: number;
}

/** Full-opacity alpha of a visible label and its background plate. */
const LABEL_TEXT_ALPHA = 235;
const LABEL_BACKGROUND_ALPHA = 190;

interface RouteDatum {
  path: [number, number][];
  timestamps: number[];
  quality: number;
  active: boolean;
  traveled: boolean; // true = this segment is already behind the truck
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
    ${produceBlock}
    ${node.type === "urban_farm" && node.localProductionCapacity ? `<div style="margin-top:6px;color:#22c55e;font-size:11px">Local Production: ${node.localProductionCapacity} kg/day</div><div style="color:#64748b;font-size:11px">Supply Radius: ${node.supplyRadiusKm} km</div>` : ''}
    ${node.type === "community_kitchen" && node.capacityKg ? `<div style="margin-top:6px;color:#f97316;font-size:11px">Capacity: ${node.capacityKg} kg/day</div><div style="color:#64748b;font-size:11px">Accepts quality ≥ ${node.acceptedQualityMin}</div>` : ''}`;
}


export default function DeckMap() {
  const nodes = useColdgridStore((s) => s.nodes);
  const edges = useColdgridStore((s) => s.edges);
  const hourOfDay = useColdgridStore((s) => s.sim.hourOfDay);
  const scenarioOffsetC = useColdgridStore((s) => s.sim.scenarioOffsetC);
  const shipments = useColdgridStore((s) => s.sim.shipments);
  const closedEdgeIds = useColdgridStore((s) => s.sim.closedEdgeIds);
  const hoveredNodeId = useColdgridStore((s) => s.hoveredNodeId);
  const selectedNodeId = useColdgridStore((s) => s.selectedNodeId);
  const setHoveredNode = useColdgridStore((s) => s.setHoveredNode);
  const setSelectedNode = useColdgridStore((s) => s.setSelectedNode);
  const setSelectedShipment = useColdgridStore((s) => s.setSelectedShipment);
  const showHeatmap = useColdgridStore((s) => s.showHeatmap);
  const showLabels = useColdgridStore((s) => s.showLabels);
  const showUHI = useColdgridStore((s) => s.showUHI);
  const heldShipments = useColdgridStore((s) => s.heldShipments);
  const heldAtHub = Object.values(heldShipments).filter((h) => h.arrivedClockHours != null);
  const blockedEdgeIds = useColdgridStore((s) => s.blockedEdgeIds);
  const reroutedShipments = useColdgridStore((s) => s.reroutedShipments);

  // Viewport ref — updated on every view-state change so TruckMarker can project lon/lat → pixels
  const viewportRef = useRef<WebMercatorViewport | null>(null);
  useEffect(() => {
    // Initialise with a best-guess size; will be overwritten on first viewState change
    if (typeof window !== "undefined") {
      viewportRef.current = new WebMercatorViewport({
        ...INITIAL_VIEW_STATE,
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, []);

  // ── Zoom-tiered label decluttering ─────────────────────────────────────────
  // The layout needs the real canvas size (the map is not the full window on
  // desktop) plus the live view state, both captured from DeckGL below.
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [viewSnapshot, setViewSnapshot] = useState<ViewSnapshot>({
    longitude: INITIAL_VIEW_STATE.longitude,
    latitude: INITIAL_VIEW_STATE.latitude,
    zoom: INITIAL_VIEW_STATE.zoom,
  });
  const pendingViewRef = useRef<ViewSnapshot>(viewSnapshot);
  const lastRelayoutRef = useRef(0);
  const relayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRelayout = useCallback(() => {
    const commit = () => {
      lastRelayoutRef.current = Date.now();
      setViewSnapshot({ ...pendingViewRef.current });
    };
    // Leading edge, then a trailing pass so the final resting view is exact.
    if (Date.now() - lastRelayoutRef.current >= LABEL_RELAYOUT_MS) commit();
    if (relayoutTimerRef.current) clearTimeout(relayoutTimerRef.current);
    relayoutTimerRef.current = setTimeout(commit, LABEL_RELAYOUT_MS);
  }, []);

  useEffect(
    () => () => {
      if (relayoutTimerRef.current) clearTimeout(relayoutTimerRef.current);
    },
    []
  );

  const labelLayout = useMemo<LabelLayout>(() => {
    if (!showLabels || canvasSize.width <= 0 || canvasSize.height <= 0) {
      return EMPTY_LABEL_LAYOUT;
    }
    const viewport = new WebMercatorViewport({
      ...viewSnapshot,
      width: canvasSize.width,
      height: canvasSize.height,
    });
    return layoutLabels({
      nodes,
      viewport,
      zoom: viewSnapshot.zoom,
      glyphRadiusPx: (n) => NODE_TYPE_STYLE[n.type].radiusPx,
    });
  }, [showLabels, canvasSize, viewSnapshot, nodes]);

  // Stable identity for the layout, so deck.gl only re-evaluates the label
  // accessors when the visible set or an anchor actually changed.
  const labelLayoutKey = useMemo(
    () =>
      Array.from(labelLayout.entries())
        .map(([id, p]) => `${id}:${p.anchor}:${p.baseline}:${p.offset.join(",")}`)
        .sort()
        .join("|"),
    [labelLayout]
  );

  // Live refs so the animation loop can read the newest layout without being
  // torn down and restarted every time the operator pans.
  const labelLayoutRef = useRef<LabelLayout>(labelLayout);
  labelLayoutRef.current = labelLayout;
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Per-label opacity, eased on the CPU. deck.gl's own attribute transitions
  // cannot be used here: the layer stack is rebuilt every animation frame, and
  // each rebuild restarts the tween before it has a chance to finish.
  const labelAlphaRef = useRef<Record<string, number>>({});
  const [labelFadeTick, setLabelFadeTick] = useState(0);

  // Global time loop: pulses the TripsLayer (0 to 100) and eases label opacity.
  const [time, setTime] = useState(0);
  useEffect(() => {
    let animationFrame: number;
    let previous = performance.now();
    const animate = () => {
      const now = performance.now();
      const step = Math.min(1, (now - previous) / LABEL_FADE_MS);
      previous = now;

      const alphas = labelAlphaRef.current;
      let faded = false;
      for (const node of nodesRef.current) {
        const target = labelLayoutRef.current.has(node.id) ? 1 : 0;
        const current = alphas[node.id] ?? 0;
        if (current === target) continue;
        alphas[node.id] =
          target > current
            ? Math.min(target, current + step)
            : Math.max(target, current - step);
        faded = true;
      }
      if (faded) setLabelFadeTick((t) => (t + 1) % 1000);

      setTime((t) => (t + 1) % 100);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
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
            traveled: i < s.legIndex,
          };
        })
      ),
    [inTransit]
  );

  // Destination positions for trucks approaching their final 2 legs
  const destPulseData = useMemo(() =>
    inTransit
      .filter((s) => s.route.length - s.legIndex <= 2)
      .map((s) => ({
        position: getEdge(s.route[s.route.length - 1]).to,
        shipmentId: s.id,
      })),
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

    // Urban Heat Island: dense-concrete zones (positive ambient offset) glow warm;
    // coastal / green / water zones (≤0 offset) stay dark = cooler.
    const UHI_COLORS: [number, number, number][] = [
      [255, 255, 178], [254, 217, 118], [254, 178, 76],
      [253, 141, 60], [240, 59, 32], [189, 0, 38],
    ];
    const uhiData: RiskPoint[] = showUHI
      ? nodes
          .map((n) => ({ position: n.coordinates, weight: Math.max(0, n.ambientOffsetC) }))
          .filter((d) => d.weight > 0)
      : [];
    const uhiLayer = new HeatmapLayer<RiskPoint>({
      id: "uhi-heat",
      data: uhiData,
      getPosition: (d) => d.position,
      getWeight: (d) => d.weight,
      radiusPixels: 95,
      intensity: 1,
      threshold: 0.03,
      colorRange: UHI_COLORS,
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

    // Traffic congestion overlay: congestionProne roads glow amber/red during rush
    const congestionData = edges.filter((e) => e.congestionProne);
    const trafficLayer = new PathLayer<CityEdge>({
      id: "traffic-heat",
      data: congestionData,
      getPath: (e) => edgePath(e),
      getColor: (e) => {
        const mult = trafficMultiplier(hourOfDay, e.congestionProne);
        const intensity = Math.min(1, (mult - 1) / 1.5); // 0 at mult=1, 1 at mult=2.5
        if (intensity < 0.05) return [0, 0, 0, 0]; // invisible at off-peak
        const r = Math.round(255 * Math.min(1, intensity * 1.5));
        const g = Math.round(180 * (1 - intensity * 0.7));
        const a = Math.round(intensity * 120);
        return [r, g, 30, a];
      },
      getWidth: (e) => {
        const mult = trafficMultiplier(hourOfDay, e.congestionProne);
        return 2 + (mult - 1) * 3; // thicker = more congested
      },
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: false,
      updateTriggers: {
        getColor: [hourOfDay],
        getWidth: [hourOfDay],
      },
    });

    // Traveled route: dim desaturated grey-blue
    const routeTraveled = new PathLayer<RouteDatum>({
      id: "route-traveled",
      data: routeData.filter((d) => d.traveled),
      getPath: (d) => d.path,
      getColor: [74, 85, 104, 120], // slate-600, desaturated
      getWidth: 2,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: false,
    });

    // Upcoming route: quality-tinted bright
    const routeAhead = new PathLayer<RouteDatum>({
      id: "route-ahead",
      data: routeData.filter((d) => !d.traveled),
      getPath: (d) => d.path,
      getColor: (d) => [...qualityToRgb(d.quality), d.active ? 240 : 110],
      getWidth: (d) => (d.active ? 4 : 2),
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
      opacity: 0.95,
      widthMinPixels: 5,
      trailLength: 28,
      currentTime: time,
      capRounded: true,
      jointRounded: true,
      updateTriggers: {
        getColor: [routeData],
      },
    });

    // Pulsing destination pin for trucks close to arrival
    const destPulseLayer = new ScatterplotLayer({
      id: "dest-pulse",
      data: destPulseData,
      getPosition: (d: { position: string; shipmentId: string }) => {
        try { return getNode(d.position).coordinates; } catch { return [80.237, 13.062] as [number, number]; }
      },
      radiusUnits: "pixels",
      getRadius: 14 + Math.sin(time / 5) * 5, // pulsing radius via time
      getFillColor: [56, 189, 248, 80],
      getLineColor: [56, 189, 248, 200],
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: false,
      updateTriggers: { getRadius: [time] },
    });

    const nodeLayer = new TextLayer<CityNode>({
      id: "nodes",
      data: nodes,
      getPosition: (n) => n.coordinates,
      characterSet: ["▲", "■", "●"],
      getText: (n) => NODE_TYPE_STYLE[n.type].glyph,
      getColor: (n) => tempToRgb(tempOf(n)),
      getSize: (n) => {
        const base = NODE_TYPE_STYLE[n.type].radiusPx * 2.8;
        return n.id === selectedNodeId ? base * 1.3 : n.id === hoveredNodeId ? base * 1.15 : base;
      },
      sizeUnits: "pixels",
      fontFamily: "system-ui, sans-serif",
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      onHover: (info: PickingInfo<CityNode>) =>
        setHoveredNode(info.object ? info.object.id : null),
      onClick: (info: PickingInfo<CityNode>) =>
        setSelectedNode(info.object ? info.object.id : null),
      updateTriggers: {
        getColor: [hourOfDay, scenarioOffsetC],
        getSize: [hoveredNodeId, selectedNodeId],
      },
    });

    // Trucks are now rendered as HTML overlays via TruckMarker (below).
    // No deck.gl IconLayer or halo ScatterplotLayer for shipments.

    // Labels are zoom-tiered and collision-resolved by lib/map/labelLayout.
    // Every node stays in the layer; hidden ones sit at zero alpha so the
    // eased opacity above can fade them in and out instead of popping.
    const placementFor = (n: CityNode) =>
      labelLayout.get(n.id) ?? defaultPlacement(NODE_TYPE_STYLE[n.type].radiusPx);
    const alphaFor = (n: CityNode) => labelAlphaRef.current[n.id] ?? 0;

    const labelLayer = new TextLayer<CityNode>({
      id: "labels",
      data: nodes,
      getPosition: (n) => n.coordinates,
      getText: (n) => n.name,
      getColor: (n) => [226, 232, 240, Math.round(LABEL_TEXT_ALPHA * alphaFor(n))],
      getSize: LABEL_FONT_SIZE_PX,
      sizeUnits: "pixels",
      fontFamily: "monospace",
      fontWeight: 500,
      getTextAnchor: (n) => placementFor(n).anchor,
      getAlignmentBaseline: (n) => placementFor(n).baseline,
      getPixelOffset: (n) => placementFor(n).offset,
      background: true,
      getBackgroundColor: (n) => [
        2,
        6,
        23,
        Math.round(LABEL_BACKGROUND_ALPHA * alphaFor(n)),
      ],
      backgroundPadding: [LABEL_PADDING_X, LABEL_PADDING_Y],
      updateTriggers: {
        getColor: [labelFadeTick],
        getBackgroundColor: [labelFadeTick],
        getTextAnchor: [labelLayoutKey],
        getAlignmentBaseline: [labelLayoutKey],
        getPixelOffset: [labelLayoutKey],
      },
      pickable: false,
    });

    // ── Blocked edge overlay (crisis road_accident / reroute) ──────────────────
    // Dimmed dashed red line over the blocked segment
    const blockedEdgeData = blockedEdgeIds
      .map((id) => { try { return getEdge(id); } catch { return null; } })
      .filter(Boolean) as CityEdge[];

    const blockedLayer = new PathLayer<CityEdge>({
      id: "blocked-edges",
      data: blockedEdgeData,
      getPath: (e) => edgePath(e),
      getColor: [239, 68, 68, 180],   // red-500 slightly transparent
      getWidth: 5,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      opacity: 0.7,
      pickable: false,
    });

    // ⚠️ warning text at midpoint of each blocked edge
    const blockedWarningLayer = new TextLayer<CityEdge>({
      id: "blocked-warning",
      data: blockedEdgeData,
      getPosition: (e) => {
        const path = edgePath(e);
        const mid = Math.floor(path.length / 2);
        return path[mid] ?? ([80.237, 13.062] as [number, number]);
      },
      getText: () => "⚠️",
      getSize: 20,
      sizeUnits: "pixels",
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      pickable: false,
    });

    // ── Flooded road overlay (Scenario 4 closedEdgeIds) ────────────────────────
    const floodedEdgeData = closedEdgeIds
      .map((id) => { try { return getEdge(id); } catch { return null; } })
      .filter(Boolean) as CityEdge[];

    const floodedLayer = new PathLayer<CityEdge>({
      id: "flooded-edges",
      data: floodedEdgeData,
      getPath: (e) => edgePath(e),
      getColor: [56, 189, 248, 180],  // sky-400 (water blue)
      getWidth: 7,
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: false,
    });

    // 🌊 flood text at midpoint
    const floodWarningLayer = new TextLayer<CityEdge>({
      id: "flood-warning",
      data: floodedEdgeData,
      getPosition: (e) => {
        const path = edgePath(e);
        const mid = Math.floor(path.length / 2);
        return path[mid] ?? [80.237, 13.062];
      },
      getText: () => "🌊",
      getSize: 18,
      sizeUnits: "pixels",
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      pickable: false,
    });

    // ── Rerouted route flash layer (bright animated green dashes) ─────────────
    const reroutedPaths: { path: [number, number][]; timestamps: number[] }[] = [];
    for (const edgeIds of Object.values(reroutedShipments)) {
      for (const edgeId of edgeIds) {
        try {
          const path = edgePath(getEdge(edgeId));
          const timestamps = path.map((_, i) => (i / Math.max(1, path.length - 1)) * 100);
          reroutedPaths.push({ path, timestamps });
        } catch { /* skip invalid edge */ }
      }
    }

    const rerouteLayer = new TripsLayer<{ path: [number, number][]; timestamps: number[] }>({
      id: "reroute-flash",
      data: reroutedPaths,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: [52, 211, 153],  // emerald-400
      opacity: 0.9,
      widthMinPixels: 4,
      trailLength: 40,
      currentTime: time,
      capRounded: true,
      jointRounded: true,
      pickable: false,
    });

    const urbanFarmLayers = getUrbanFarmLayers(nodes, time, hourOfDay, scenarioOffsetC);

    const base = [
      ...urbanFarmLayers,
      roadLayer, trafficLayer,
      floodedLayer, floodWarningLayer,
      blockedLayer, blockedWarningLayer,
      rerouteLayer,
      routeTraveled, routeAhead, routeTrips,
      destPulseLayer, nodeLayer,
      // Always mounted: the manual toggle empties the layout instead of
      // unmounting the layer, so "labels off" fades out rather than snapping.
      labelLayer,
    ];
    // Heat overlays render UNDER the network (prepended = bottom of the stack).
    const overlays = [];
    if (showUHI) overlays.push(uhiLayer);
    if (showHeatmap) overlays.push(heatLayer);
    return [...overlays, ...base];
    // tempOf closes over hourOfDay/scenarioOffsetC; listed below so layers rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodes,
    edges,
    routeData,
    riskData,
    showHeatmap,
    showLabels,
    labelLayout,
    labelLayoutKey,
    labelFadeTick,
    showUHI,
    inTransit,
    hourOfDay,
    scenarioOffsetC,
    hoveredNodeId,
    selectedNodeId,
    setHoveredNode,
    setSelectedNode,
    setSelectedShipment,
    destPulseData,
    time,
    blockedEdgeIds,
    closedEdgeIds,
    reroutedShipments,
  ]);

  return (
    <div className="relative h-full w-full">
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState }) => {
          viewportRef.current = new WebMercatorViewport(viewState as ConstructorParameters<typeof WebMercatorViewport>[0]);
          const v = viewState as ViewSnapshot;
          pendingViewRef.current = {
            longitude: v.longitude,
            latitude: v.latitude,
            zoom: v.zoom,
          };
          scheduleRelayout();
        }}
        onResize={({ width, height }) =>
          setCanvasSize((prev) =>
            prev.width === width && prev.height === height
              ? prev
              : { width, height }
          )
        }
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        getTooltip={(info: PickingInfo) => {
          if (!info.object) return null;
          const layerId = info.layer?.id;
          let html: string | null = null;
          if (layerId === "nodes") {
            const node = info.object as CityNode;
            html = nodeTooltipHtml(node, tempOf(node));
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

      {/* HTML truck overlays — 60fps rAF-smoothed, project lon/lat via viewportRef */}
      {inTransit.map((s) => (
        <TruckMarker key={s.id} shipment={s} viewportRef={viewportRef} />
      ))}

      {/* Parked-at-hub markers for incomplete (diverted) deliveries */}
      {heldAtHub.map((h) => (
        <HeldMarker key={h.shipmentId} held={h} viewportRef={viewportRef} />
      ))}
    </div>
  );
}
