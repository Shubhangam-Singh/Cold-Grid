/**
 * Starter SOP excerpts. These are templates, not operating procedures from
 * a live control room. Search is keyword overlap. Citations are the titles.
 */

export interface KnowledgeDoc {
  id: string;
  title: string;
  body: string;
}

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: "sop-excursion",
    title: "Template · temperature excursion",
    body: "When cargo sits above its produce stress temperature, compute shelf-life cost with the Arrhenius engine. Prefer a cold hub hold if the trip still has hours left. Do not invent a new threshold.",
  },
  {
    id: "sop-sensor",
    title: "Template · sensor fault",
    body: "A flat trace or a jump larger than 10°C is a sensor fault until a second sample confirms it. Do not divert a truck on one impossible jump.",
  },
  {
    id: "sop-sell",
    title: "Template · hold or sell",
    body: "Sell-now price comes from the five-band table on current quality. A hub hold keeps that price only while quality holds. Storage is 250 rupees per hour after the truck parks.",
  },
  {
    id: "sop-chain",
    title: "Template · ledger",
    body: "If on-chain anchoring is off, say not anchored. A hash mismatch on the browser ledger is a broken seal. Do not claim a mainnet transaction.",
  },
];

export function searchKnowledge(query: string): { id: string; title: string; excerpt: string }[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const scored = KNOWLEDGE.map((doc) => {
    const hay = `${doc.title} ${doc.body}`.toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { doc, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map((row) => ({
    id: row.doc.id,
    title: row.doc.title,
    excerpt: row.doc.body,
  }));
}
