import { readFileSync } from "node:fs";

export interface CopilotConfig {
  name: string;
  port: number;
  bind: "127.0.0.1";
  ollama: string;
  model: string;
  temperature: number;
  timeoutMs: number;
}

const DEFAULTS: CopilotConfig = {
  name: "FROST",
  port: 8787,
  bind: "127.0.0.1",
  ollama: "http://127.0.0.1:11434",
  model: "llama3.2:3b",
  temperature: 0.2,
  timeoutMs: 8000,
};

function pick(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, "");
}

/** Bind stays on loopback even if the file says otherwise. */
export function loadConfig(path: string): CopilotConfig {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return DEFAULTS;
  }
  const port = Number(pick(text, "port") ?? DEFAULTS.port);
  const temperature = Number(pick(text, "temperature") ?? DEFAULTS.temperature);
  const timeoutMs = Number(pick(text, "timeoutMs") ?? DEFAULTS.timeoutMs);
  return {
    name: pick(text, "name") || DEFAULTS.name,
    port: Number.isFinite(port) ? port : DEFAULTS.port,
    bind: "127.0.0.1",
    ollama: pick(text, "ollama") || DEFAULTS.ollama,
    model: pick(text, "model") || DEFAULTS.model,
    temperature: Number.isFinite(temperature) ? Math.min(0.3, Math.max(0, temperature)) : DEFAULTS.temperature,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULTS.timeoutMs,
  };
}
