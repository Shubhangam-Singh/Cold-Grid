/**
 * Turn one bridge websocket payload into a SensorReading.
 * Accepts the serial bridge shape (`tempC` / `humidity` / `gas`) and the
 * cart's `/api/data` names (`temp` / `humidity` / `vocPPM`).
 */

import type { SensorReading } from "./types";

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function flag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function parseFrame(data: unknown): SensorReading | null {
  if (data == null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const tempC = num(d.tempC ?? d.T ?? d.temp);
  if (tempC == null) return null;
  const humidity = num(d.humidity ?? d.H ?? d.rh) ?? 0;
  const gas = num(d.gas ?? d.G ?? d.VOC ?? d.voc ?? d.vocPPM) ?? 0;
  const at = num(d.at) ?? Date.now() / 1000;
  const produce = typeof d.produce === "string" && d.produce.trim() !== "" ? d.produce : undefined;
  return {
    tempC,
    humidity,
    gas,
    at,
    produce,
    freshness: num(d.freshness),
    price: num(d.price),
    rate: num(d.rate),
    thermalEMA: num(d.thermalEMA),
    hoursRemaining: num(d.hoursRemaining),
    spike: flag(d.spike),
    expired: flag(d.expired),
  };
}
