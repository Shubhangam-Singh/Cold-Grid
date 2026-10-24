import { describeConfirm } from "@/lib/copilot/confirm";
import { addMemory, appendAudit, listAudit } from "@/lib/copilot/journal";
import { callSidecar, localGuard } from "../proxy";

const MAP_ACTIONS = new Set(["sell-now", "hold-hub", "divert-kitchen"]);
const RECORD_ACTIONS = new Set(["acknowledge", "snooze", "note", "remember", "update_threshold", "request_reanchor"]);

export async function GET(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  const remote = await callSidecar("/audit");
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json({ entries: listAudit(), sidecar: false });
}

export async function POST(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  let record: Record<string, unknown>;
  try {
    record = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "No data." }, { status: 400 });
  }
  const remote = await callSidecar("/audit", {
    method: "POST",
    body: JSON.stringify(record),
    timeoutMs: 800,
  });
  if (remote?.ok) return Response.json(await remote.json());
  const action = String(record.action ?? "");
  const shipmentId = String(record.shipmentId ?? "").slice(0, 40);
  if (MAP_ACTIONS.has(action)) {
    appendAudit({ action, shipmentId, detail: String(record.detail ?? "").slice(0, 500) });
    return Response.json({ ok: true, sidecar: false });
  }
  if (!RECORD_ACTIONS.has(action)) {
    return Response.json({ error: "That action is not on the allowlist." }, { status: 400 });
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
  appendAudit({ action: described.action, shipmentId: described.shipmentId, detail: described.detail });
  if (action === "remember") {
    const kind = record.kind === "preference" || record.kind === "episode" ? record.kind : "decision";
    addMemory(kind, String(record.content ?? record.note ?? ""));
  }
  return Response.json({ ok: true, applied: described.applied, detail: described.detail, sidecar: false });
}
