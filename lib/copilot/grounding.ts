/**
 * Every number and shipment id in a draft must already appear in the fact
 * bag built from tool output. A failed check drops the draft.
 */

const NUMBER = /-?\d+(?:\.\d+)?/g;
const SHIPMENT = /\bSHP-\d+\b/g;

export function verifyGrounding(draft: string, facts: string[]): { ok: boolean; missing: string[] } {
  const bag = facts.join("\n");
  const missing: string[] = [];
  const numbers = draft.match(NUMBER) ?? [];
  for (const n of numbers) {
    if (!bag.includes(n)) missing.push(n);
  }
  const ids = draft.match(SHIPMENT) ?? [];
  for (const id of ids) {
    if (!bag.includes(id)) missing.push(id);
  }
  return { ok: missing.length === 0, missing };
}
