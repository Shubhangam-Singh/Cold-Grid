/**
 * Runs the copilot tests and writes eval/REPORT.md from that output.
 * A missing local model is recorded as skipped, not as a pass.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, "..");
const started = new Date().toISOString();
const result = spawnSync(
  "npx",
  ["vitest", "run", "lib/copilot", "store/coldgridStore.test.ts"],
  { cwd: app, encoding: "utf8", shell: true }
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
const passed = result.status === 0 && /Test Files\s+\d+ passed/.test(plain);
const summary = plain.split("\n").filter((line) => /Test Files|Tests |Duration/.test(line)).join("\n");
const report = `# FROST eval

Run at: ${started}
Exit code: ${result.status}

## Fast path

${passed ? "The vitest copilot suite passed." : "The vitest copilot suite failed."}

\`\`\`
${summary || output.slice(-2000)}
\`\`\`

Numeric checks in this suite compare engine output with expected facts. They do not call a hosted model.

## Agent path

Skipped. Ollama is not installed on this PC, and no model was pulled. Latency for a local model was not measured. A rules answer is not counted as a model pass.

## Targets

- Excursion and tamper checks are in the detector and simulator tests.
- Sensor-fault F1 is asserted at or above 0.9 on the labelled set in \`lib/copilot/copilot.test.ts\`.
- Forecast MAE must beat the naive baseline on the straight series in that file.
- Golden questions: \`eval/golden.yaml\`, at least 60, checked by the same suite.
`;
writeFileSync(join(root, "REPORT.md"), report);
process.stdout.write(output);
process.exit(result.status ?? 1);
