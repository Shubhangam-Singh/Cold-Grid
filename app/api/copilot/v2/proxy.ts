import { isLocalRequest } from "./guard";

const SIDECAR = process.env.COLDGRID_COPILOT_URL || "http://127.0.0.1:8787";
const TOKEN = process.env.COLDGRID_COPILOT_TOKEN || "coldgrid-local";

export function localGuard(req: Request): Response | null {
  if (!isLocalRequest(req)) {
    return Response.json({ error: "Copilot is local only." }, { status: 403 });
  }
  return null;
}

export async function callSidecar(
  path: string,
  init?: { method?: string; body?: string; timeoutMs?: number }
): Promise<Response | null> {
  try {
    return await fetch(`${SIDECAR}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "x-coldgrid-token": TOKEN,
      },
      body: init?.body,
      signal: AbortSignal.timeout(init?.timeoutMs ?? 800),
    });
  } catch {
    return null;
  }
}
