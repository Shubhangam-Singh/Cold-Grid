/**
 * The live AI copilot endpoint (spec Phase 7) — FLAG-GATED, default OFF.
 *
 * RULE 3: with NEXT_PUBLIC_ENABLE_COPILOT unset/false (or no API key), this
 * returns { enabled: false } and the client falls back to the free heuristic
 * engine. Only when the flag is true AND a key is present does it call Claude.
 * The app never depends on this route.
 */

import Anthropic from "@anthropic-ai/sdk";

// Needs the Node runtime for the Anthropic SDK; never cache.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are the ColdGrid Copilot — a cold-chain operations advisor for Chennai's perishable-food network. You are grounded in the patented PPSC Adaptive Arrhenius + EMA spoilage physics: spoilage rate follows Arrhenius/Q10 (each ~10 C roughly doubles–triples the rate), and a thermal-memory (EMA) term means past heat keeps damaging cargo even after re-cooling.

You are given a factual status snapshot. Give 2–4 SHORT, prioritized, concrete operator actions (specific setpoints, routes, or re-dispatch decisions). Use the exact numbers provided — never invent shipments or values. Lead with the most urgent. Keep it tight: one line per action, plain text, no preamble.`;

interface CopilotRequest {
  context?: string;
}

export async function POST(req: Request): Promise<Response> {
  const enabled =
    process.env.NEXT_PUBLIC_ENABLE_COPILOT === "true" &&
    !!process.env.ANTHROPIC_API_KEY;

  if (!enabled) {
    // Free-mode default: tell the client to use its heuristic engine.
    return Response.json({ enabled: false });
  }

  let body: CopilotRequest;
  try {
    body = (await req.json()) as CopilotRequest;
  } catch {
    return Response.json({ enabled: true, error: "bad request" }, { status: 400 });
  }
  const context = (body.context ?? "").slice(0, 8000);

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  try {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 700,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" }, // quick, scoped advice
        system: SYSTEM,
        messages: [{ role: "user", content: context }],
      },
      { timeout: 12_000, maxRetries: 1 }
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (response.stop_reason === "refusal" || !text) {
      return Response.json({ enabled: true, error: "no response" });
    }
    return Response.json({ enabled: true, text, model });
  } catch {
    // Timeout / network / API error → client gracefully falls back to heuristics.
    return Response.json({ enabled: true, error: "unavailable" });
  }
}
