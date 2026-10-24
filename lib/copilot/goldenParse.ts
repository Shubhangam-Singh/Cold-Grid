export interface GoldenCase {
  id: string;
  question: string;
  includes: string[];
  excludes: string[];
}

function strip(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

/** Small reader for the golden file. It is not a general YAML parser. */
export function parseGolden(text: string): GoldenCase[] {
  const cases: GoldenCase[] = [];
  let current: GoldenCase | null = null;
  let list: "includes" | "excludes" | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (raw.startsWith("- id:")) {
      if (current) cases.push(current);
      current = { id: strip(raw.slice(5)), question: "", includes: [], excludes: [] };
      list = null;
      continue;
    }
    if (!current) continue;
    if (raw.startsWith("  question:")) {
      current.question = strip(raw.slice("  question:".length));
      list = null;
      continue;
    }
    if (raw.startsWith("  includes:")) {
      list = "includes";
      continue;
    }
    if (raw.startsWith("  excludes:")) {
      list = "excludes";
      continue;
    }
    if (list && raw.trim().startsWith("- ")) {
      current[list].push(strip(raw.trim().slice(2)));
    }
  }
  if (current) cases.push(current);
  return cases;
}
