import { renderReport } from "@/lib/copilot/report";
import type { CopilotWorld } from "@/lib/copilot/world";
import { callSidecar, localGuard } from "../proxy";

export async function POST(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  let body: { world?: CopilotWorld };
  try {
    body = (await req.json()) as { world?: CopilotWorld };
  } catch {
    return Response.json({ error: "No data." }, { status: 400 });
  }
  if (!body.world || !Array.isArray(body.world.shipments)) {
    return Response.json({ error: "No fleet snapshot." }, { status: 400 });
  }
  const remote = await callSidecar("/report", {
    method: "POST",
    body: JSON.stringify({ world: body.world }),
    timeoutMs: 2000,
  });
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json({ ...renderReport(body.world), saved: false, sidecar: false });
}
