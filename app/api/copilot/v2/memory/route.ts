import { addMemory, deleteMemory, listMemory } from "@/lib/copilot/journal";
import { callSidecar, localGuard } from "../proxy";

export async function GET(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  const remote = await callSidecar("/memory");
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json({ items: listMemory(), sidecar: false });
}

export async function POST(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  let record: { kind?: unknown; content?: unknown };
  try {
    record = (await req.json()) as { kind?: unknown; content?: unknown };
  } catch {
    return Response.json({ error: "No data." }, { status: 400 });
  }
  const remote = await callSidecar("/memory", {
    method: "POST",
    body: JSON.stringify(record),
    timeoutMs: 800,
  });
  if (remote?.ok) return Response.json(await remote.json());
  const kind = record.kind === "preference" || record.kind === "episode" ? record.kind : "decision";
  return Response.json({ ...addMemory(kind, String(record.content ?? "")), sidecar: false });
}

export async function DELETE(req: Request) {
  const denied = localGuard(req);
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const remote = await callSidecar(`/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (remote?.ok) return Response.json(await remote.json());
  return Response.json({ deleted: deleteMemory(id), sidecar: false });
}
