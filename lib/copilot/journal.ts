/**
 * Append-only audit and editable memory for one process.
 * The sidecar keeps its own copy in SQLite. This is the in-process copy.
 */

export interface AuditEntry {
  at: string;
  action: string;
  shipmentId: string;
  detail: string;
}

export interface MemoryItem {
  id: string;
  kind: "preference" | "decision" | "episode";
  content: string;
  at: string;
}

const audit: AuditEntry[] = [];
const memory: MemoryItem[] = [];

export function listAudit(): AuditEntry[] {
  return audit.slice();
}

export function appendAudit(entry: Omit<AuditEntry, "at"> & { at?: string }): AuditEntry {
  const row: AuditEntry = {
    at: entry.at ?? new Date().toISOString(),
    action: entry.action,
    shipmentId: entry.shipmentId,
    detail: entry.detail,
  };
  audit.push(row);
  return row;
}

export function listMemory(): MemoryItem[] {
  return memory.slice();
}

export function addMemory(kind: MemoryItem["kind"], content: string): MemoryItem {
  const row: MemoryItem = {
    id: `mem-${memory.length + 1}`,
    kind,
    content: content.slice(0, 500),
    at: new Date().toISOString(),
  };
  memory.push(row);
  return row;
}

export function deleteMemory(id: string): boolean {
  const index = memory.findIndex((row) => row.id === id);
  if (index < 0) return false;
  memory.splice(index, 1);
  return true;
}

export function resetJournal(): void {
  audit.length = 0;
  memory.length = 0;
}
