/**
 * Pure session for one live PPSC cart. The map simulation never reads this.
 * Readings step a side batch on the firmware's 2-second λ. A dropped socket
 * does not reset that batch — the caller freezes the last figures.
 */

import { createBatch, stepBatch } from "../engine/spoilage";
import { getProduce } from "../engine/produce";
import type { Batch, ProduceId } from "../engine/types";
import { breachThresholdC } from "../chain/attestation";
import { GENESIS_PREV, hashBlock, type ChainVerification } from "../chain/ledger";
import type { LedgerBlock, TempAttestation } from "../chain/types";
import { withFirmwareClock } from "./firmwareClock";
import type { SensorReading } from "./types";

export const LIVE_BATCH_ID = "live-ppsc";
/** Shipment name attested for the cart, on the browser ledger and on the local chain. */
export const LIVE_SHIPMENT_ID = "PPSC-LIVE";
export const STALE_AFTER_S = 6;
/** Same cap as the firmware dt rollover guard: one missed gap cannot exceed 60s. */
export const LIVE_DT_CAP_HOURS = 60 / 3600;
export const HISTORY_CAP = 500;
/** About 24 minutes at a 2-second sample. Older blocks drop off the front; the link between the ones kept still verifies. */
export const CHAIN_CAP = 720;

const PRODUCE_BY_NAME: Record<string, ProduceId> = {
  tomato: "tomato",
  banana: "banana",
  apple: "apple",
  "leafy veg": "leafyVeg",
  leafyveg: "leafyVeg",
  mango: "mango",
  milk: "milk",
  fish: "fish",
  paneer: "paneer",
};

export function produceFromDeviceName(name: string | undefined): ProduceId {
  if (!name) return "fish";
  const key = name.trim().toLowerCase().replace(/[_-]+/g, " ");
  return PRODUCE_BY_NAME[key] ?? PRODUCE_BY_NAME[key.replace(/ /g, "")] ?? "fish";
}

export interface LiveSession {
  reading: SensorReading | null;
  history: SensorReading[];
  cartBatch: Batch | null;
  cartProduce: ProduceId;
  chain: LedgerBlock[];
  seq: number;
}

export function emptyLiveSession(): LiveSession {
  return { reading: null, history: [], cartBatch: null, cartProduce: "fish", chain: [], seq: 0 };
}

export function isReadingStale(reading: SensorReading, nowMs: number, staleAfterS = STALE_AFTER_S): boolean {
  return nowMs / 1000 - reading.at > staleAfterS;
}

export type BenchMode = "synthetic" | "awaiting" | "live" | "lost";

export function benchMode(args: {
  listen: boolean;
  connected: boolean;
  reading: SensorReading | null;
  nowMs: number;
}): BenchMode {
  if (!args.listen) return "synthetic";
  if (!args.reading) return "awaiting";
  if (!args.connected || isReadingStale(args.reading, args.nowMs)) return "lost";
  return "live";
}

function clampQuality(q: number): number {
  return Math.min(100, Math.max(0, q));
}

function sealBlock(chain: LedgerBlock[], attestation: TempAttestation, at: number): LedgerBlock[] {
  const index = chain.length === 0 ? 0 : chain[chain.length - 1].index + 1;
  const prevHash = chain.length > 0 ? chain[chain.length - 1].hash : GENESIS_PREV;
  const partial = { index, timestamp: Math.floor(at), attestation, prevHash };
  return [...chain, { ...partial, hash: hashBlock(partial) }];
}

/**
 * Check a live chain that may have dropped its oldest blocks.
 * Block 0 of this window does not have to be genesis. Every stored block's
 * hash still has to match its contents, and each link has to match the block before it.
 */
export function verifyOpenChain(chain: LedgerBlock[]): ChainVerification {
  for (let i = 0; i < chain.length; i++) {
    const block = chain[i];
    if (i > 0 && block.prevHash !== chain[i - 1].hash) {
      return {
        intact: false,
        brokenAtIndex: i,
        reason: `Block ${block.index}: broken link to previous block.`,
      };
    }
    const recomputed = hashBlock({
      index: block.index,
      timestamp: block.timestamp,
      attestation: block.attestation,
      prevHash: block.prevHash,
    });
    if (recomputed !== block.hash) {
      return {
        intact: false,
        brokenAtIndex: i,
        reason: `Block ${block.index}: contents were altered after sealing.`,
      };
    }
  }
  if (chain.length === 0) {
    return { intact: true, brokenAtIndex: null, reason: "Waiting for the first PPSC reading." };
  }
  return { intact: true, brokenAtIndex: null, reason: "Live chain intact — every cart block verifies." };
}

/** Append one frame. The same `at` twice is a no-op so a replayed socket frame cannot double-step. */
export function ingestReading(
  session: LiveSession,
  reading: SensorReading,
  opts?: { chainCap?: number; produceOverride?: ProduceId }
): LiveSession {
  if (session.reading && session.reading.at === reading.at) return session;

  const produce = reading.produce
    ? produceFromDeviceName(reading.produce)
    : (opts?.produceOverride ?? "fish");
  const profile = withFirmwareClock(getProduce(produce));
  const sameProduce = session.cartBatch != null && session.cartProduce === produce;
  let batch = sameProduce && session.cartBatch ? session.cartBatch : createBatch(LIVE_BATCH_ID, produce);

  if (sameProduce && session.reading) {
    const dtHours = Math.min(
      LIVE_DT_CAP_HOURS,
      Math.max(0, (reading.at - session.reading.at) / 3600)
    );
    if (dtHours > 0) {
      batch = stepBatch(batch, profile, reading.tempC, reading.humidity, reading.gas, dtHours);
    }
  }

  if (reading.freshness != null && Number.isFinite(reading.freshness)) {
    batch = { ...batch, quality: clampQuality(reading.freshness) };
  }

  const attestation: TempAttestation = {
    shipmentId: LIVE_SHIPMENT_ID,
    seq: session.seq,
    reportedTempC: reading.tempC,
    trueTempC: reading.tempC,
    thresholdC: breachThresholdC(produce),
    postedBy: "transporter",
  };
  const cap = opts?.chainCap ?? CHAIN_CAP;
  const chain = sealBlock(session.chain, attestation, reading.at).slice(-cap);

  return {
    reading,
    history: [...session.history, reading].slice(-HISTORY_CAP),
    cartBatch: batch,
    cartProduce: produce,
    chain,
    seq: session.seq + 1,
  };
}
