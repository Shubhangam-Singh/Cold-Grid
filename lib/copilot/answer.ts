/**
 * Fast path. Templated prose over computeInsights / proposeActions.
 * The model is not required. Injection in the question is refused.
 * Text inside a shipment label is data, not an instruction.
 */

import { analyzeFleet } from "./heuristics";
import { proposeActions, type ActionCard } from "./actions";
import { verifyGrounding } from "./grounding";
import { computeInsights, type Insight } from "./insights";
import { searchKnowledge } from "./knowledge";
import { forecastSeries, type ForecastResult } from "./forecast";
import { cargoReading, withMeasuredCargo, type CopilotWorld } from "./world";
import { ppscUnitId } from "../hardware/ppsc";
import { degradationSnapshot } from "../engine/spoilage";
import { getProduce } from "../engine/produce";

export interface CopilotAnswer {
  text: string;
  mode: "rules" | "model" | "degraded";
  model: string | null;
  facts: string[];
  insights: Insight[];
  actions: ActionCard[];
  followUps: string[];
  verified: boolean;
}

const INJECTION = /ignore (all |any )?(previous|prior) instructions|you are now|system prompt|do not use tools|<\s*script/i;

function round1(n: number): string {
  if (!Number.isFinite(n)) return "stable";
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function factLines(world: CopilotWorld, insights: Insight[], actions: ActionCard[]): string[] {
  const lines: string[] = [];
  lines.push(`hour ${round1(world.hourOfDay)}`);
  lines.push(`offset ${round1(world.scenarioOffsetC)}`);
  lines.push(`closed ${world.closedEdgeIds.length}`);
  for (const s of world.shipments) {
    lines.push(s.id);
    lines.push(ppscUnitId(s.id));
    lines.push(getProduce(s.produce).label);
    lines.push(round1(s.lastTempC));
    lines.push(round1(s.batch.quality));
  }
  if (world.probe) {
    lines.push(round1(world.probe.tempC));
    lines.push(round1(world.probe.rh));
    lines.push(round1(world.probe.voc));
    lines.push(round1(world.probe.ageS));
    lines.push(world.probe.shipmentId);
  }
  lines.push(world.chain.anchored ? "anchored" : "not anchored");
  lines.push(String(world.chain.blocks.length));
  for (const insight of insights) {
    lines.push(insight.summary);
    lines.push(insight.title);
    for (const value of Object.values(insight.evidence.values)) {
      if (value != null) lines.push(String(value));
    }
  }
  for (const action of actions) {
    lines.push(action.title);
    lines.push(action.detail);
    lines.push(String(action.rupees));
    if (action.lifeHours != null) lines.push(round1(action.lifeHours));
    if (action.hubId) lines.push(action.hubId);
  }
  return lines;
}

function findShipment(world: CopilotWorld, message: string) {
  const token = message.match(/PPSC-\d+|SHP-\d+/i)?.[0];
  if (!token) return null;
  const asPpsc = token.toUpperCase();
  return (
    world.shipments.find((s) => s.id.toLowerCase() === token.toLowerCase() || ppscUnitId(s.id).toLowerCase() === asPpsc.toLowerCase()) ??
    null
  );
}

function pack(
  world: CopilotWorld,
  text: string,
  insights: Insight[],
  actions: ActionCard[],
  followUps: string[],
  extraFacts: string[] = []
): CopilotAnswer {
  const facts = [...factLines(world, insights, actions), ...extraFacts];
  const check = verifyGrounding(text, facts);
  const safe = check.ok
    ? text
    : "I could not verify every number in that draft, so I dropped it. Ask for a shipment id, a forecast, or a sell-versus-hold comparison.";
  return {
    text: safe,
    mode: "rules",
    model: null,
    facts,
    insights,
    actions,
    followUps,
    verified: check.ok,
  };
}

export function answerQuestion(world: CopilotWorld, message: string): CopilotAnswer {
  const asked = message.trim();
  const insights = computeInsights(world);
  const measured = withMeasuredCargo(world);
  const report = analyzeFleet({
    seed: 0,
    tick: 0,
    clockHours: world.clockHours,
    hourOfDay: world.hourOfDay,
    scenarioOffsetC: world.scenarioOffsetC,
    closedEdgeIds: world.closedEdgeIds,
    shipments: measured.shipments,
    nextId: 1,
    activeCrises: [],
    crisisHistory: [],
  });

  if (INJECTION.test(asked)) {
    return pack(
      world,
      "I cannot follow instructions embedded in a question. Ask about a shipment, the probe, shelf life, or the ledger.",
      insights,
      [],
      ["Status of the fleet", "Is the ledger anchored?"]
    );
  }

  if (/\b(delhi|mumbai|weather forecast|stock price|who won)\b/i.test(asked)) {
    return pack(
      world,
      "No data for that. This copilot only sees the ColdGrid fleet on this PC.",
      insights,
      [],
      ["Fleet status"]
    );
  }

  const whatIf = asked.match(/(-?\d+(?:\.\d+)?)\s*°?\s*c[^0-9]{0,12}(\d+(?:\.\d+)?)\s*h/i);
  const subject = findShipment(world, asked) ?? (world.shipments.length === 1 ? world.shipments[0] : null);

  if (/what if|what-if|\/whatif|\bwhatif\b/i.test(asked)) {
    if (!subject || !whatIf) {
      return pack(
        world,
        "Name a shipment and a temperature and a duration, for example: what if SHP-1 sits at 8°C for 2 h.",
        insights,
        [],
        [],
        ["8", "2", "SHP-1"]
      );
    }
    const tempC = Number(whatIf[1]);
    const hours = Number(whatIf[2]);
    const profile = getProduce(subject.produce);
    const reading = cargoReading(world, subject);
    const snap = degradationSnapshot(subject.batch, profile, tempC, reading.rh, reading.voc);
    const loss = snap.qualityLossPerHour * hours;
    const quality = Math.min(100, Math.max(0, subject.batch.quality - loss));
    const text = `${subject.id} held at ${round1(tempC)}°C for ${round1(hours)} h would lose about ${round1(loss)} quality points, ending near ${round1(quality)}%. Rate versus 25°C is ${round1(snap.rate)}×.`;
    return pack(world, text, insights, proposeActions(world, subject.id), ["Sell or hold?"], [
      subject.id,
      round1(tempC),
      round1(hours),
      round1(loss),
      round1(quality),
      round1(snap.rate),
    ]);
  }

  if (/anchor|blockchain|tamper|integrity|ledger|\/verify/i.test(asked)) {
    const chain = insights.find((i) => i.type === "integrity");
    return pack(world, chain?.summary ?? "No ledger status.", insights, [], ["Fleet status"]);
  }

  if (/forecast|\/forecast|predict/i.test(asked)) {
    if (!subject) {
      return pack(world, "Which shipment should I forecast? Give an id such as SHP-1.", insights, [], []);
    }
    const series = world.recentTemps[subject.id] ?? [];
    const forecast = forecastSeries(series, 1);
    const text = forecast
      ? forecastSentence(subject.id, forecast)
      : `No forecast for ${subject.id}: fewer than 4 temperature samples.`;
    const extra = forecast
      ? [
          subject.id,
          String(forecast.samples),
          round1(forecast.point),
          forecast.mae.toFixed(2),
          forecast.naiveMae.toFixed(2),
          forecast.slopeMae.toFixed(2),
        ]
      : [subject.id, "4"];
    return pack(world, text, insights, proposeActions(world, subject.id), [], extra);
  }

  if (/sell|hold|divert|rupee|what should|\/risk/i.test(asked)) {
    const target = subject ?? measured.shipments.find((s) => s.status === "in-transit") ?? null;
    if (!target) {
      return pack(world, report.summary, insights, [], []);
    }
    const actions = proposeActions(world, target.id);
    const lines = actions.map((a) => a.detail);
    const text = [`${getProduce(target.produce).label} ${target.id}.`, ...lines].join(" ");
    return pack(world, text, insights, actions, ["Is the ledger anchored?", "Forecast this truck"]);
  }

  if (/sop|procedure|template|knowledge/i.test(asked)) {
    const hits = searchKnowledge(asked);
    const text =
      hits.length === 0
        ? "No matching SOP template."
        : hits.map((h) => `${h.title}: ${h.excerpt}`).join(" ");
    return pack(
      world,
      text,
      insights,
      [],
      [],
      hits.flatMap((h) => [h.title, h.excerpt])
    );
  }

  const named = findShipment(world, asked);
  if (named && /status|how is|temp|temperature|quality/i.test(asked)) {
    const one = insights.find((i) => i.entityId === named.id && i.type === "freshness");
    const actions = proposeActions(world, named.id);
    return pack(world, one?.summary ?? `${named.id} has no in-transit freshness row.`, insights, actions, [
      "Sell or hold?",
    ]);
  }

  if (world.shipments.filter((s) => s.status === "in-transit").length > 1 && /which truck|the truck\b/i.test(asked) && !subject) {
    const ids = world.shipments.filter((s) => s.status === "in-transit").map((s) => s.id);
    return pack(world, `More than one truck is moving: ${ids.join(", ")}. Which id?`, insights, [], []);
  }

  if (/^\/?(brief|briefing)$/i.test(asked) || /^\/?report$/i.test(asked)) {
    return pack(world, fleetStatus(report.summary, insights), insights, [], ["Sell or hold?", "Forecast this truck"]);
  }

  if (/why|disagree|different from/i.test(asked)) {
    const probeLine = insights.find((row) => row.type === "probe");
    const freshLine = insights.find((row) => row.type === "freshness" && (!subject || row.entityId === subject.id));
    const text = [probeLine?.summary, freshLine?.summary].filter(Boolean).join(" ");
    return pack(
      world,
      text || "No probe comparison is in this snapshot.",
      insights,
      subject ? proposeActions(world, subject.id) : [],
      []
    );
  }

  const actions = subject ? proposeActions(world, subject.id) : [];
  return pack(world, fleetStatus(report.summary, insights), insights, actions, ["Sell or hold?", "Is the ledger anchored?"]);
}

/** Status chat: fleet line, the probe comparison, and shelf life. A tenth of a degree over the line stays in Insights. */
function fleetStatus(summary: string, insights: Insight[]): string {
  const lines = [summary];
  for (const insight of insights) {
    if (insight.type === "probe" || insight.type === "freshness") lines.push(insight.summary);
    if (insight.type === "excursion" && insight.severity === "warn") lines.push(insight.summary);
  }
  return lines.join(" ");
}

function forecastSentence(id: string, forecast: ForecastResult): string {
  const point = (Math.round(forecast.point * 10) / 10).toFixed(1);
  if (forecast.method === "slope") {
    return `${id} slope forecast from ${forecast.samples} samples is about ${point}°C. Backtest MAE ${forecast.slopeMae.toFixed(2)} versus last-reading MAE ${forecast.naiveMae.toFixed(2)}.`;
  }
  return `${id} holds the last reading, about ${point}°C, from ${forecast.samples} samples. Last-reading MAE ${forecast.naiveMae.toFixed(2)} beats slope MAE ${forecast.slopeMae.toFixed(2)}.`;
}
