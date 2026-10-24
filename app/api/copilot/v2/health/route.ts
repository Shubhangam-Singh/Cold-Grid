import { callSidecar, localGuard } from "../proxy";

export async function GET(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  const remote = await callSidecar("/health", { timeoutMs: 800 });
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json({
    ok: true,
    name: "FROST",
    engine: "rules",
    sidecar: false,
    model: null,
    ollama: false,
    degraded: false,
    port: 8787,
  });
}
