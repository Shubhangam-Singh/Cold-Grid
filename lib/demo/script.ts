/**
 * Demo Mode (spec Phase 8) — a fixed-seed, scripted run that records cleanly
 * for the 5–7 min competition video and replays IDENTICALLY every time
 * (RULE 4). PURE declarative data: the DemoMode controller interprets the
 * actions and fires each step when the deterministic sim clock crosses its
 * `atHours`, so the outcome depends only on the seed — never on wall-clock
 * timing or playback speed.
 */

import type { DispatchOptions } from "../engine/simulation";

/** Fixed seed — the run is byte-identical on every replay. */
export const DEMO_SEED = 12345;
/** Wall-clock start hour for the scripted day. */
export const DEMO_START_HOUR = 5;
/** Sim hours after which the demo ends. */
export const DEMO_DURATION_HOURS = 8.5;

export type DemoAction =
  | { type: "dispatch"; opts: DispatchOptions }
  | { type: "scenario"; offsetC: number }
  | { type: "speed"; speed: number }
  | { type: "heatmap"; on: boolean };

export interface DemoStep {
  /** Sim hours since reset at which this step fires. */
  atHours: number;
  /** On-screen narration caption (also announced to screen readers). */
  caption: string;
  actions?: DemoAction[];
}

export const DEMO_SCRIPT: DemoStep[] = [
  {
    atHours: 0,
    caption: "05:00 — Dawn at Kasimedu. Fresh fish is dispatched, refrigerated, to Mylapore market.",
    actions: [
      { type: "speed", speed: 1 },
      { type: "heatmap", on: false },
      { type: "scenario", offsetC: 0 },
      {
        type: "dispatch",
        opts: { produce: "fish", fromId: "kasimedu", toId: "mylapore", transportSetpointC: 2 },
      },
    ],
  },
  {
    atHours: 0.6,
    caption: "Aavin Dairy sends milk to Adyar under refrigeration — dairy is unforgiving.",
    actions: [
      {
        type: "dispatch",
        opts: { produce: "milk", fromId: "aavin-madhavaram", toId: "adyar", transportSetpointC: 3 },
      },
    ],
  },
  {
    atHours: 1.2,
    caption: "Hardy tomatoes ride an ambient truck to T. Nagar — no need to spend energy chilling them.",
    actions: [
      { type: "dispatch", opts: { produce: "tomato", fromId: "koyambedu", toId: "t-nagar" } },
    ],
  },
  {
    atHours: 2.0,
    caption: "⚠ A 40°C heatwave grips the city. Watch the spoilage-risk heatmap light up.",
    actions: [
      { type: "scenario", offsetC: 8 },
      { type: "heatmap", on: true },
      { type: "speed", speed: 2 },
    ],
  },
  {
    atHours: 2.7,
    caption: "An ambient leafy-veg run to Velachery will struggle in this heat — the copilot flags it.",
    actions: [
      { type: "dispatch", opts: { produce: "leafyVeg", fromId: "koyambedu", toId: "velachery" } },
    ],
  },
  {
    atHours: 3.4,
    caption: "The operator answers with a refrigerated dairy run — cold buys back the margin.",
    actions: [
      {
        type: "dispatch",
        opts: { produce: "milk", fromId: "aavin-madhavaram", toId: "velachery", transportSetpointC: 2 },
      },
    ],
  },
  {
    atHours: 5.0,
    caption: "Click any shipment to open its decay curve and see exactly why it spoiled — or didn't.",
  },
  {
    atHours: 6.5,
    caption: "The heatwave passes; the network recovers and the risk map cools.",
    actions: [
      { type: "scenario", offsetC: 0 },
      { type: "heatmap", on: false },
    ],
  },
  {
    atHours: 8.0,
    caption:
      "ColdGrid — one city's entire cold chain, powered by the patented PPSC Adaptive Arrhenius + EMA engine.",
  },
];
