/**
 * Precompute layer. Every number comes from the spoilage engine, the
 * forecast, or the ledger verifier. Nothing here is a guess.
 */

import { verifyChain } from "../chain/ledger";
import { verifyOpenChain } from "../hardware/liveSession";
import { getProduce } from "../engine/produce";
import { degradationSnapshot, KELVIN, predictedShelfLifeHours } from "../engine/spoilage";
import type { Shipment } from "../engine/simulation";
import { remainingTravelHours } from "./heuristics";
import { detectExcursion, detectFault, detectTamper } from "./detectors";
import { forecastSeries } from "./forecast";
import { cargoReading, unprobedCargoC, withMeasuredCargo, type CopilotWorld } from "./world";

export type InsightSeverity = "info" | "watch" | "warn" | "critical";

export interface InsightEvidence {
  source: string;
  values: Record<string, number | string | null>;
  timeRange: string | null;
}

export interface Insight {
  id: string;
  type: string;
  severity: InsightSeverity;
  entityType: "fleet" | "shipment" | "probe" | "chain";
  entityId: string;
  title: string;
  summary: string;
  evidence: InsightEvidence;
  metrics: Record<string, number | null>;
  confidence: number;
  status: "open";
}

const RANK: Record<InsightSeverity, number> = { critical: 0, warn: 1, watch: 2, info: 3 };

function round1(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 10) / 10;
}

function shipmentInsight(world: CopilotWorld, shipment: Shipment): Insight[] {
  const measured = withMeasuredCargo(world);
  const ship = measured.shipments.find((s) => s.id === shipment.id) ?? shipment;
  if (ship.status !== "in-transit") return [];
  const profile = getProduce(ship.produce);
  const reading = cargoReading(world, shipment);
  const snap = degradationSnapshot(ship.batch, profile, reading.tempC, reading.rh, reading.voc);
  const life = predictedShelfLifeHours(ship.batch, profile, reading.tempC);
  const travel = remainingTravelHours(ship);
  const thresholdC = profile.thermalStressK - KELVIN;
  const trace = world.recentTemps[ship.id] ?? [reading.tempC];
  const out: Insight[] = [];

  const spoiled = ship.batch.quality <= 0 || ship.batch.cumulativeDeg >= 1;
  const lifeLabel = Number.isFinite(life) ? `${round1(life)} h` : "stable";
  out.push({
    id: `${ship.id}-freshness`,
    type: "freshness",
    severity: spoiled || life < travel ? "critical" : life < travel * 1.5 ? "warn" : "info",
    entityType: "shipment",
    entityId: ship.id,
    title: `${profile.label} ${ship.id} shelf life`,
    summary: spoiled
      ? `${profile.label} ${ship.id} has spoiled. Quality is ${round1(ship.batch.quality)}%.`
      : `${profile.label} ${ship.id}: at ${round1(reading.tempC)}°C (${reading.source}) about ${lifeLabel} of life remains, with ${round1(travel)} h still to drive. Quality ${round1(ship.batch.quality)}%.`,
    evidence: {
      source: reading.source === "probe" ? "ppsc-probe" : "sim-sensor",
      values: {
        tempC: round1(reading.tempC),
        rh: round1(reading.rh),
        voc: round1(reading.voc),
        lifeH: Number.isFinite(life) ? round1(life) : null,
        travelH: round1(travel),
        quality: round1(ship.batch.quality),
        rate: round1(snap.rate),
      },
      timeRange: null,
    },
    metrics: {
      tempC: reading.tempC,
      lifeH: Number.isFinite(life) ? life : null,
      travelH: travel,
      quality: ship.batch.quality,
    },
    confidence: reading.source === "probe" ? 0.95 : 0.7,
    status: "open",
  });

  if (detectExcursion([reading.tempC], thresholdC)) {
    const lifeAtLine = predictedShelfLifeHours(ship.batch, profile, thresholdC);
    const overC = reading.tempC - thresholdC;
    const shortened = Number.isFinite(lifeAtLine) && Number.isFinite(life) ? lifeAtLine - life : null;
    const meaningful = overC >= 1;
    out.push({
      id: `${ship.id}-excursion`,
      type: "excursion",
      severity: meaningful ? "warn" : "info",
      entityType: "shipment",
      entityId: ship.id,
      title: `${profile.label} ${ship.id} is above ${round1(thresholdC)}°C`,
      summary:
        shortened != null && shortened > 0
          ? `Cargo is ${round1(reading.tempC)}°C, ${round1(overC)}°C over the ${round1(thresholdC)}°C line. If it stays here, remaining life is about ${round1(shortened)} h shorter than at the line. That is not hours already lost.`
          : `Cargo is ${round1(reading.tempC)}°C, ${round1(overC)}°C over the ${round1(thresholdC)}°C line.`,
      evidence: {
        source: reading.source === "probe" ? "ppsc-probe" : "sim-sensor",
        values: {
          tempC: round1(reading.tempC),
          thresholdC: round1(thresholdC),
          overC: round1(overC),
          shorterLifeH: shortened == null ? null : round1(shortened),
        },
        timeRange: null,
      },
      metrics: { tempC: reading.tempC, thresholdC, overC, shorterLifeH: shortened },
      confidence: meaningful ? 1 : 0.5,
      status: "open",
    });
  }

  const fault = detectFault(trace);
  if (fault !== "ok") {
    out.push({
      id: `${ship.id}-fault`,
      type: "sensor-health",
      severity: "watch",
      entityType: "shipment",
      entityId: ship.id,
      title: fault === "flatline" ? `${ship.id} temperature trace is flat` : `${ship.id} temperature jumped`,
      summary:
        fault === "flatline"
          ? `${trace.length} samples are identical. That looks like a stuck sensor, not a thermal event.`
          : `A step in the trace is larger than 10°C. Check the probe before treating it as cargo heat.`,
      evidence: { source: "temp-trace", values: { samples: trace.length, lastC: round1(trace[trace.length - 1]) }, timeRange: null },
      metrics: { samples: trace.length },
      confidence: 0.8,
      status: "open",
    });
  }

  const forecast = forecastSeries(trace, 1);
  if (forecast) {
    out.push({
      id: `${ship.id}-forecast`,
      type: "forecast",
      severity: "info",
      entityType: "shipment",
      entityId: ship.id,
      title: `${ship.id} temperature forecast`,
      summary:
        forecast.method === "slope"
          ? `Slope forecast from ${forecast.samples} samples: about ${round1(forecast.point)}°C next step. Backtest MAE ${forecast.slopeMae.toFixed(2)} versus last-reading MAE ${forecast.naiveMae.toFixed(2)}.`
          : `Last reading holds. Next step about ${round1(forecast.point)}°C from ${forecast.samples} samples. Last-reading MAE ${forecast.naiveMae.toFixed(2)} beats slope MAE ${forecast.slopeMae.toFixed(2)}.`,
      evidence: {
        source: "temp-trace",
        values: {
          pointC: round1(forecast.point),
          mae: Number(forecast.mae.toFixed(3)),
          naiveMae: Number(forecast.naiveMae.toFixed(3)),
          samples: forecast.samples,
        },
        timeRange: `${forecast.samples} samples`,
      },
      metrics: { pointC: forecast.point, mae: forecast.mae, naiveMae: forecast.naiveMae },
      confidence: forecast.mae <= forecast.naiveMae ? 0.6 : 0.4,
      status: "open",
    });
  }

  return out;
}

function chainInsight(world: CopilotWorld): Insight {
  if (!world.chain.anchored && world.chain.blocks.length === 0) {
    return {
      id: "chain-unanchored",
      type: "integrity",
      severity: "info",
      entityType: "chain",
      entityId: "ledger",
      title: "Ledger is not anchored",
      summary: "On-chain anchoring is off, and this session has no browser blocks. Integrity status: not anchored.",
      evidence: { source: "ledger", values: { anchored: "no", blocks: 0 }, timeRange: null },
      metrics: { blocks: 0 },
      confidence: 1,
      status: "open",
    };
  }
  const tamper = world.chain.blocks.length > 0 && world.chain.kind !== "none"
    ? detectTamper(world.chain.blocks, world.chain.kind === "genesis" ? "genesis" : "open")
    : false;
  const verdict =
    world.chain.kind === "genesis"
      ? verifyChain(world.chain.blocks)
      : verifyOpenChain(world.chain.blocks);
  return {
    id: tamper ? "chain-tamper" : "chain-status",
    type: "integrity",
    severity: tamper ? "critical" : "info",
    entityType: "chain",
    entityId: "ledger",
    title: tamper ? "Ledger mismatch" : world.chain.anchored ? "Ledger anchored" : "Browser ledger only",
    summary: tamper
      ? `${verdict.reason} Treat this as a broken seal.`
      : world.chain.anchored
        ? `${world.chain.blocks.length} blocks checked. ${verdict.reason}`
        : `Not anchored on a chain RPC. Browser ledger has ${world.chain.blocks.length} block(s). ${verdict.reason}`,
    evidence: {
      source: world.chain.anchored ? "chain-rpc" : "browser-ledger",
      values: { blocks: world.chain.blocks.length, intact: tamper ? "no" : "yes", anchored: world.chain.anchored ? "yes" : "no" },
      timeRange: null,
    },
    metrics: { blocks: world.chain.blocks.length },
    confidence: 1,
    status: "open",
  };
}

export function computeInsights(world: CopilotWorld): Insight[] {
  const insights: Insight[] = [];
  const probe = world.probe;
  if (probe && !probe.stale) {
    const ship = world.shipments.find((s) => s.id === probe.shipmentId);
    const withoutCart = ship ? unprobedCargoC(world, ship) : null;
    if (ship && withoutCart != null && Math.abs(withoutCart - probe.tempC) >= 1) {
      insights.push({
        id: `${probe.shipmentId}-probe-vs-sim`,
        type: "probe",
        severity: "info",
        entityType: "probe",
        entityId: probe.shipmentId,
        title: `Probe and city temperature disagree on ${probe.shipmentId}`,
        summary: `The cart probe reads ${round1(probe.tempC)}°C. Without the cart this truck would be at ${round1(withoutCart)}°C. Advice for this truck uses the probe.`,
        evidence: {
          source: "ppsc-probe",
          values: { probeC: round1(probe.tempC), cityC: round1(withoutCart) },
          timeRange: `${round1(probe.ageS)} s ago`,
        },
        metrics: { probeC: probe.tempC, cityC: withoutCart },
        confidence: 1,
        status: "open",
      });
    }
  } else if (probe?.stale) {
    insights.push({
      id: "probe-stale",
      type: "sensor-health",
      severity: "watch",
      entityType: "probe",
      entityId: probe.shipmentId,
      title: "Cart probe is stale",
      summary: `Last cart sample is ${round1(probe.ageS)} s old. This truck has fallen back to its simulated sensor.`,
      evidence: { source: "ppsc-probe", values: { ageS: round1(probe.ageS) }, timeRange: null },
      metrics: { ageS: probe.ageS },
      confidence: 1,
      status: "open",
    });
  }

  for (const shipment of world.shipments) {
    insights.push(...shipmentInsight(world, shipment));
  }

  const hotOpen = world.shipments.filter((s) => {
    if (s.status !== "in-transit" || s.transportSetpointC != null) return false;
    const threshold = getProduce(s.produce).thermalStressK - KELVIN;
    return cargoReading(world, s).tempC > threshold;
  });
  if (world.scenarioOffsetC >= 4 && hotOpen.length >= 2) {
    insights.push({
      id: "root-heatwave",
      type: "root-cause",
      severity: "warn",
      entityType: "fleet",
      entityId: "city",
      title: "Several open trucks are hot together",
      summary: `Scenario offset is +${round1(world.scenarioOffsetC)}°C and ${hotOpen.length} open trucks are above their stress line. That pattern fits the city heat, not one broken probe.`,
      evidence: { source: "fleet", values: { offsetC: world.scenarioOffsetC, trucks: hotOpen.length }, timeRange: null },
      metrics: { trucks: hotOpen.length, offsetC: world.scenarioOffsetC },
      confidence: 0.75,
      status: "open",
    });
  }

  insights.push(chainInsight(world));

  const inTransit = world.shipments.filter((s) => s.status === "in-transit");
  const critical = insights.filter((i) => i.severity === "critical" && i.type === "freshness").length;
  insights.push({
    id: "fleet-kpi",
    type: "kpi",
    severity: critical > 0 ? "warn" : "info",
    entityType: "fleet",
    entityId: "fleet",
    title: "Fleet snapshot",
    summary: `${inTransit.length} in transit. ${critical} projected to run out of shelf life before arrival. Closed roads: ${world.closedEdgeIds.length}.`,
    evidence: {
      source: "fleet",
      values: { inTransit: inTransit.length, critical, closedRoads: world.closedEdgeIds.length },
      timeRange: null,
    },
    metrics: { inTransit: inTransit.length, critical },
    confidence: 1,
    status: "open",
  });

  insights.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return insights;
}

export function briefingFrom(insights: Insight[]): string {
  const top = insights.filter((i) => i.type !== "kpi").slice(0, 3);
  if (top.length === 0) return "Nothing in transit needs a decision.";
  return top.map((i) => i.summary).join(" ");
}
