/**
 * Append-only audit and editable memory for the sidecar.
 * SQLite when node:sqlite opens. A JSONL file in the same folder otherwise.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface AuditRow {
  at: string;
  action: string;
  shipmentId: string;
  detail: string;
}

export interface MemoryRow {
  id: string;
  kind: string;
  content: string;
  at: string;
}

export interface CopilotStore {
  kind: "sqlite" | "jsonl";
  appendAudit(row: AuditRow): void;
  listAudit(): AuditRow[];
  addMemory(kind: string, content: string): MemoryRow;
  listMemory(): MemoryRow[];
  deleteMemory(id: string): boolean;
}

interface Statement {
  run(...args: (string | number | null)[]): { lastInsertRowid: number | bigint };
  all(...args: (string | number | null)[]): Record<string, unknown>[];
}

interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}

export async function openStore(dir: string): Promise<CopilotStore> {
  mkdirSync(dir, { recursive: true });
  try {
    const specifier = "node:sqlite";
    const mod = (await import(specifier)) as { DatabaseSync: new (path: string) => SqliteDb };
    const db = new mod.DatabaseSync(join(dir, "copilot.sqlite"));
    db.exec(`CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      action TEXT NOT NULL,
      shipment_id TEXT NOT NULL,
      detail TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      at TEXT NOT NULL
    )`);
    return {
      kind: "sqlite",
      appendAudit(row) {
        db.prepare("INSERT INTO audit (at, action, shipment_id, detail) VALUES (?, ?, ?, ?)").run(
          row.at,
          row.action,
          row.shipmentId,
          row.detail
        );
      },
      listAudit() {
        return db
          .prepare("SELECT at, action, shipment_id, detail FROM audit ORDER BY id")
          .all()
          .map((row) => ({
            at: String(row.at),
            action: String(row.action),
            shipmentId: String(row.shipment_id),
            detail: String(row.detail),
          }));
      },
      addMemory(kind, content) {
        const at = new Date().toISOString();
        const info = db.prepare("INSERT INTO memory (kind, content, at) VALUES (?, ?, ?)").run(kind, content.slice(0, 500), at);
        return { id: `mem-${info.lastInsertRowid}`, kind, content: content.slice(0, 500), at };
      },
      listMemory() {
        return db
          .prepare("SELECT id, kind, content, at FROM memory ORDER BY id")
          .all()
          .map((row) => ({
            id: `mem-${row.id}`,
            kind: String(row.kind),
            content: String(row.content),
            at: String(row.at),
          }));
      },
      deleteMemory(id) {
        const num = Number(String(id).replace(/^mem-/, ""));
        if (!Number.isFinite(num)) return false;
        db.prepare("DELETE FROM memory WHERE id = ?").run(num);
        return true;
      },
    };
  } catch {
    return jsonlStore(dir);
  }
}

function jsonlStore(dir: string): CopilotStore {
  const auditFile = join(dir, "audit.jsonl");
  const memoryFile = join(dir, "memory.jsonl");
  const audit: AuditRow[] = [];
  const memory: MemoryRow[] = [];
  let seq = 1;
  return {
    kind: "jsonl",
    appendAudit(row) {
      audit.push(row);
      appendFileSync(auditFile, JSON.stringify(row) + "\n");
    },
    listAudit() {
      return audit.slice();
    },
    addMemory(kind, content) {
      const row = { id: `mem-${seq++}`, kind, content: content.slice(0, 500), at: new Date().toISOString() };
      memory.push(row);
      appendFileSync(memoryFile, JSON.stringify(row) + "\n");
      return row;
    },
    listMemory() {
      return memory.slice();
    },
    deleteMemory(id) {
      const index = memory.findIndex((row) => row.id === id);
      if (index < 0) return false;
      memory.splice(index, 1);
      return true;
    },
  };
}
