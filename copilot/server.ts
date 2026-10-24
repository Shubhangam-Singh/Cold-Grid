/**
 * FROST sidecar. Loopback only. The Next.js app proxies to this process.
 * Rules answers do not need Ollama. A model is used only when it is already installed.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { answerWithProvider, probeOllama, type LlmProvider } from "../lib/copilot/agent";
import { describeConfirm } from "../lib/copilot/confirm";
import { computeInsights } from "../lib/copilot/insights";
import { renderReport } from "../lib/copilot/report";
import type { CopilotWorld } from "../lib/copilot/world";
import { loadConfig } from "./loadConfig";
import { openStore, type CopilotStore } from "./store";

const root = dirname(fileURLToPath(import.meta.url));
const config = loadConfig(join(root, "..", "copilot.config.yaml"));
const token = process.env.COLDGRID_COPILOT_TOKEN || "coldgrid-local";
const MAP_ACTIONS = new Set(["sell-now", "hold-hub", "divert-kitchen"]);
const RECORD_ACTIONS = new Set(["acknowledge", "snooze", "note", "remember", "update_threshold", "request_reanchor"]);

let systemPrompt = "You are FROST. Use only the verified facts.";
try {
  systemPrompt = readFileSync(join(root, "prompts", "system.md"), "utf8");
} catch {
  /* the short default stands */
}

function isWorld(value: unknown): value is CopilotWorld {
  if (!value || typeof value !== "object") return false;
  const world = value as CopilotWorld;
  return Array.isArray(world.shipments) && typeof world.hourOfDay === "number" && !!world.chain && Array.isArray(world.chain.blocks);
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "access-control-allow-origin": "http://localhost:3000",
    "vary": "Origin",
  });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

function ollamaProvider(model: string): LlmProvider {
  return {
    name: model,
    async chat(prompt: string) {
      const res = await fetch(`${config.ollama}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          keep_alive: "10m",
          options: { temperature: config.temperature },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!res.ok) throw new Error(`ollama ${res.status}`);
      const body = (await res.json()) as { message?: { content?: string } };
      return { content: body.message?.content ?? "" };
    },
  };
}

async function main() {
  const store: CopilotStore = await openStore(join(root, "data"));
  let lastWorld: CopilotWorld | null = null;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "http://localhost:3000",
        "access-control-allow-headers": "content-type, x-coldgrid-token",
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      });
      res.end();
      return;
    }
    if (req.headers["x-coldgrid-token"] !== token) {
      send(res, 401, { error: "Local token required." });
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        const ollama = await probeOllama(config.ollama);
        const ready = ollama.up && ollama.models.some((name) => name === config.model || name.startsWith(`${config.model}:`));
        send(res, 200, {
          ok: true,
          name: config.name,
          engine: ready ? "model" : "rules",
          sidecar: true,
          bind: config.bind,
          port: config.port,
          data: store.kind,
          ollama: ollama.up,
          model: ready ? config.model : null,
          modelConfigured: config.model,
          modelPulled: ready,
          degraded: false,
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/audit") {
        send(res, 200, { entries: store.listAudit() });
        return;
      }
      if (req.method === "GET" && url.pathname === "/memory") {
        send(res, 200, { items: store.listMemory() });
        return;
      }
      if (req.method === "DELETE" && url.pathname === "/memory") {
        send(res, 200, { deleted: store.deleteMemory(url.searchParams.get("id") ?? "") });
        return;
      }
      if (req.method === "GET" && url.pathname === "/insights") {
        if (!lastWorld) {
          send(res, 200, { insights: [], detail: "No fleet snapshot yet." });
          return;
        }
        send(res, 200, { insights: computeInsights(lastWorld) });
        return;
      }
      const body = req.method === "POST" ? await readBody(req) : {};
      const record = body as Record<string, unknown>;
      if (req.method === "POST" && url.pathname === "/sync") {
        if (!isWorld(record.world)) {
          send(res, 400, { error: "No fleet snapshot." });
          return;
        }
        lastWorld = record.world;
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && url.pathname === "/chat") {
        if (!isWorld(record.world)) {
          send(res, 400, { error: "No fleet snapshot." });
          return;
        }
        lastWorld = record.world;
        const message = String(record.message ?? "").slice(0, 2000);
        const ollama = await probeOllama(config.ollama);
        const ready = ollama.up && ollama.models.some((name) => name === config.model || name.startsWith(`${config.model}:`));
        const answer = await answerWithProvider(record.world, message, ready ? ollamaProvider(config.model) : null);
        send(res, 200, answer);
        return;
      }
      if (req.method === "POST" && url.pathname === "/audit") {
        const action = String(record.action ?? "");
        const shipmentId = String(record.shipmentId ?? "").slice(0, 40);
        if (MAP_ACTIONS.has(action)) {
          store.appendAudit({
            at: new Date().toISOString(),
            action,
            shipmentId,
            detail: String(record.detail ?? "").slice(0, 500),
          });
          send(res, 200, { ok: true });
          return;
        }
        if (!RECORD_ACTIONS.has(action)) {
          send(res, 400, { error: "That action is not on the allowlist." });
          return;
        }
        const described = describeConfirm({
          action,
          shipmentId,
          note: typeof record.note === "string" ? record.note : undefined,
          minutes: typeof record.minutes === "number" ? record.minutes : undefined,
          product: typeof record.product === "string" ? record.product : undefined,
          minC: typeof record.minC === "number" ? record.minC : undefined,
          maxC: typeof record.maxC === "number" ? record.maxC : undefined,
          kind: record.kind === "preference" || record.kind === "decision" || record.kind === "episode" ? record.kind : undefined,
          content: typeof record.content === "string" ? record.content : undefined,
          anchored: record.anchored === true,
        });
        store.appendAudit({
          at: new Date().toISOString(),
          action: described.action,
          shipmentId: described.shipmentId,
          detail: described.detail,
        });
        if (action === "remember") {
          const kind = record.kind === "preference" || record.kind === "episode" ? record.kind : "decision";
          store.addMemory(kind, String(record.content ?? record.note ?? "").slice(0, 500));
        }
        send(res, 200, { ok: true, applied: described.applied, detail: described.detail });
        return;
      }
      if (req.method === "POST" && url.pathname === "/memory") {
        const kind = record.kind === "preference" || record.kind === "episode" ? record.kind : "decision";
        const row = store.addMemory(kind, String(record.content ?? "").slice(0, 500));
        store.appendAudit({ at: row.at, action: "remember", shipmentId: "memory", detail: row.content });
        send(res, 200, row);
        return;
      }
      if (req.method === "POST" && url.pathname === "/report") {
        if (!isWorld(record.world)) {
          send(res, 400, { error: "No fleet snapshot." });
          return;
        }
        send(res, 200, { ...renderReport(record.world), saved: false });
        return;
      }
      send(res, 404, { error: "Not found." });
    } catch {
      send(res, 500, { error: "The copilot could not complete that request." });
    }
  });

  server.listen(config.port, config.bind, () => {
    console.log(`FROST listening on http://${config.bind}:${config.port} (${store.kind})`);
  });
}

void main();
