/**
 * Local report. The prose is a template over Insight rows.
 */

import { proposeActions } from "./actions";
import { briefingFrom, computeInsights } from "./insights";
import type { CopilotWorld } from "./world";

export function renderReport(world: CopilotWorld): { markdown: string; csv: string } {
  const insights = computeInsights(world);
  const moving = world.shipments.filter((s) => s.status === "in-transit");
  const lines = [
    "# FROST shift note",
    "",
    "This note is the rules engine. It is not a model.",
    "",
    briefingFrom(insights),
    "",
  ];
  for (const insight of insights) {
    if (insight.type === "kpi") continue;
    lines.push(`- ${insight.severity.toUpperCase()} · ${insight.title}. ${insight.summary}`);
  }
  lines.push("");
  for (const shipment of moving) {
    const cards = proposeActions(world, shipment.id);
    if (cards.length === 0) continue;
    lines.push(`## ${shipment.id}`);
    for (const card of cards) {
      lines.push(`- ${card.title}. ${card.detail}`);
    }
    lines.push("");
  }
  const csv = [
    "severity,type,entity,title",
    ...insights.map((i) =>
      [i.severity, i.type, i.entityId, `"${i.title.replace(/"/g, "'")}"`].join(",")
    ),
  ].join("\n");
  return { markdown: lines.join("\n").trim() + "\n", csv: csv + "\n" };
}
