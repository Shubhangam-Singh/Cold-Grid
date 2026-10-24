/**
 * Optional local model. If Ollama is down, or the draft cites a number that
 * was not in the tool facts, the rules answer is what the admin sees.
 */

import { answerQuestion, type CopilotAnswer } from "./answer";
import { verifyGrounding } from "./grounding";
import type { CopilotWorld } from "./world";

export interface LlmTurn {
  content: string;
}

export interface LlmProvider {
  name: string;
  chat(prompt: string): Promise<LlmTurn>;
}

export async function answerWithProvider(
  world: CopilotWorld,
  message: string,
  provider: LlmProvider | null
): Promise<CopilotAnswer> {
  const rules = answerQuestion(world, message);
  if (!provider) return rules;
  try {
    const factBlock = rules.facts.slice(0, 80).join("\n");
    const first = await provider.chat(
      `Verified facts:\n${factBlock}\n\nQuestion: ${message}\nAnswer using only those facts.`
    );
    const facts = rules.facts;
    let check = verifyGrounding(first.content, facts);
    if (!check.ok) {
      const second = await provider.chat(
        `Those tokens are not in the tool output: ${check.missing.join(", ")}. Answer again using only verified facts.`
      );
      check = verifyGrounding(second.content, facts);
      if (!check.ok) {
        return { ...rules, mode: "degraded", model: provider.name };
      }
      return { ...rules, text: second.content, mode: "model", model: provider.name, verified: true };
    }
    return { ...rules, text: first.content, mode: "model", model: provider.name, verified: true };
  } catch {
    return { ...rules, mode: "degraded", model: provider.name };
  }
}

export async function probeOllama(host = "http://127.0.0.1:11434"): Promise<{ up: boolean; models: string[] }> {
  try {
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(700) });
    if (!res.ok) return { up: false, models: [] };
    const body = (await res.json()) as { models?: { name: string }[] };
    return { up: true, models: (body.models ?? []).map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}
