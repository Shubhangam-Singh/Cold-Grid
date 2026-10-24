import { answerQuestion } from "@/lib/copilot/answer";
import type { CopilotWorld } from "@/lib/copilot/world";
import { callSidecar, localGuard } from "../proxy";

export async function POST(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  let body: { message?: unknown; world?: CopilotWorld };
  try {
    body = (await req.json()) as { message?: unknown; world?: CopilotWorld };
  } catch {
    return Response.json({ error: "No data." }, { status: 400 });
  }
  if (!body.world || !Array.isArray(body.world.shipments)) {
    return Response.json({ error: "No fleet snapshot." }, { status: 400 });
  }
  const message = String(body.message ?? "").slice(0, 2000);
  const remote = await callSidecar("/chat", {
    method: "POST",
    body: JSON.stringify({ message, world: body.world }),
    timeoutMs: 12000,
  });
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json(answerQuestion(body.world, message));
}
