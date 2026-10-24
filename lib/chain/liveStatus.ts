/** Read-back from /api/chain/live. Empty unless NEXT_PUBLIC_ENABLE_CHAIN is on. */

export interface LiveChainStatus {
  enabled: boolean;
  reachable?: boolean;
  shipmentId?: string;
  breachCount?: number | null;
  lastTxHash?: string | null;
  lastTempC?: number | null;
  error?: string;
}
