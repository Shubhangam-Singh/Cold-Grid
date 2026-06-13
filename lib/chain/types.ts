/**
 * Phase 9 — Blockchain Trust Layer (domain types).
 *
 * ISOLATED module (safe to delete). The in-app SIMULATED ledger is the always-on
 * default (NEXT_PUBLIC_ENABLE_CHAIN=false, RULE 3): pure TypeScript, no chain, no
 * deps. The real Solidity contracts in /contracts mirror these exact rules.
 *
 * Honesty note carried into the UI: the temperature "oracle" here is the
 * ColdGrid simulation itself. In the real world that role is played by a
 * decentralized oracle network such as Chainlink feeding signed sensor data.
 */

import type { ProduceId } from "../engine/types";

/** AccessControl roles — mirror the OpenZeppelin roles in ColdChainAttestation.sol. */
export type ChainRole = "farmer" | "transporter" | "retailer" | "auditor";

/** A single temperature attestation posted to the ledger for a shipment. */
export interface TempAttestation {
  shipmentId: string;
  /** Monotonic sequence within this shipment's trace (deterministic). */
  seq: number;
  /** Temperature the poster CLAIMS (°C) — what a self-reported log would show. */
  reportedTempC: number;
  /** The simulation's true reading (°C) — the oracle. Never visible to a cheater. */
  trueTempC: number;
  /** Cold-chain breach threshold for this produce (°C). */
  thresholdC: number;
  /** Which role posted it (only `transporter` is authorized). */
  postedBy: ChainRole;
}

/** A hash-linked block wrapping one attestation. */
export interface LedgerBlock {
  index: number;
  /** Deterministic timestamp (sequence-based, not wall-clock) — keeps replays identical. */
  timestamp: number;
  attestation: TempAttestation;
  prevHash: string;
  hash: string;
}

/** Escrow contract terms agreed between supplier and buyer. */
export interface EscrowTerms {
  produce: ProduceId;
  /** Full payment if compliant (₹). */
  paymentRupees: number;
  /** Breach readings tolerated before a penalty applies. */
  maxBreaches: number;
  /** Penalty withheld per breach over the limit (₹). */
  penaltyPerBreach: number;
}

export type SettlementMode = "off-chain-trust" | "on-chain";

/** The outcome of settling an escrow against an attestation trace. */
export interface Settlement {
  mode: SettlementMode;
  /** Breaches the self-reported log claims. */
  reportedBreaches: number;
  /** Breaches that actually happened (oracle truth). */
  trueBreaches: number;
  /** The count the settlement actually acted on. */
  breachesUsed: number;
  /** reported < true — someone under-reported to look compliant. */
  fraudDetected: boolean;
  /** Whether the hash chain verified (on-chain mode). */
  chainIntact: boolean;
  /** What the supplier is paid (₹). */
  payoutRupees: number;
  /** What the buyer withholds (₹). */
  withheldRupees: number;
  explanation: string;
}
