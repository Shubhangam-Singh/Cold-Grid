/**
 * Confirm-gated records. None of these rewrite produce constants or send a
 * transaction. The map moves (hold, divert, sell-now) live in the store.
 */

export type MemoryKind = "preference" | "decision" | "episode";

export interface ConfirmResult {
  action: string;
  shipmentId: string;
  detail: string;
  /** False when the request was recorded and the fleet was left unchanged. */
  applied: boolean;
}

export function describeConfirm(req: {
  action: string;
  shipmentId?: string;
  note?: string;
  minutes?: number;
  product?: string;
  minC?: number;
  maxC?: number;
  kind?: MemoryKind;
  content?: string;
  anchored?: boolean;
}): ConfirmResult {
  const shipmentId = (req.shipmentId ?? "").slice(0, 40);
  const note = (req.note ?? req.content ?? "").slice(0, 500);
  switch (req.action) {
    case "acknowledge":
      return { action: "acknowledge", shipmentId, detail: note || "Acknowledged.", applied: true };
    case "snooze": {
      const minutes = Number.isFinite(req.minutes) ? Math.min(24 * 60, Math.max(1, req.minutes as number)) : 30;
      return { action: "snooze", shipmentId, detail: `Snoozed for ${minutes} min. ${note}`.trim(), applied: true };
    }
    case "note":
      return { action: "note", shipmentId, detail: note || "Empty note.", applied: true };
    case "remember":
      return {
        action: "remember",
        shipmentId: shipmentId || "memory",
        detail: `${req.kind ?? "decision"}: ${note || "Empty."}`,
        applied: true,
      };
    case "update_threshold":
      return {
        action: "update_threshold",
        shipmentId: shipmentId || (req.product ?? "produce"),
        detail: `Recorded a threshold request for ${req.product ?? "produce"} (${req.minC ?? "?"} to ${req.maxC ?? "?"} °C). Produce constants in produce.ts were not changed.`,
        applied: false,
      };
    case "request_reanchor":
      return {
        action: "request_reanchor",
        shipmentId: shipmentId || "ledger",
        detail: req.anchored
          ? "Re-anchor was requested. This build does not send a transaction from the copilot."
          : "Not anchored. No chain RPC is in use, so nothing was sent.",
        applied: false,
      };
    default:
      return { action: "reject", shipmentId, detail: "That action is not on the allowlist.", applied: false };
  }
}
