/**
 * Academy game-state machine (spec §7.1): SELECT → BRIEFING → OPERATE → RUNNING
 * → RESULT. It coordinates the pure academy logic with the shared simulation
 * store so the operate/run phases animate on the same twin map.
 *
 * Scoring is authoritative from the pure headless run (simulateScenario +
 * scoreScenario); the on-map animation uses the same seed, so it matches.
 */

import { create } from "zustand";
import {
  SCENARIOS,
  getScenario,
  suggestedDecisions,
} from "@/lib/academy/scenarios";
import { type DeliveryResult, scenarioInitialSim, simulateScenario } from "@/lib/academy/run";
import { type ScenarioScore, scoreScenario } from "@/lib/academy/scoring";
import type { DeliveryDecision } from "@/lib/academy/types";
import { useColdgridStore } from "./coldgridStore";

export type AcademyPhase = "select" | "briefing" | "operate" | "running" | "result";

export interface CompletedRecord {
  stars: number;
  composite: number;
}

interface AcademyState {
  phase: AcademyPhase;
  scenarioId: string | null;
  /** Per-delivery decisions, keyed by deliveryId. */
  decisions: Record<string, DeliveryDecision>;
  results: DeliveryResult[] | null;
  score: ScenarioScore | null;
  /** Best result per scenario (for certification + progress). */
  completed: Record<string, CompletedRecord>;

  openBriefing: (scenarioId: string) => void;
  startOperate: () => void;
  setDecision: (deliveryId: string, patch: Partial<DeliveryDecision>) => void;
  runDay: () => void;
  finishRun: () => void;
  retry: () => void;
  nextScenario: () => void;
  backToSelect: () => void;
}

function decisionsArray(decisions: Record<string, DeliveryDecision>): DeliveryDecision[] {
  return Object.values(decisions);
}

/** Reset the shared map to this scenario and dispatch the planned shipments (paused). */
function loadPlannedOntoMap(scenarioId: string, decisions: Record<string, DeliveryDecision>) {
  const scenario = getScenario(scenarioId);
  const cg = useColdgridStore.getState();
  cg.loadSim(scenarioInitialSim(scenario));
  for (const d of scenario.requiredDeliveries) {
    const decision = decisions[d.id];
    if (!decision || !decision.dispatched) continue;
    cg.dispatch({
      produce: d.produce,
      fromId: d.fromId,
      toId: d.toId,
      label: d.label,
      transportSetpointC: decision.reefer ? decision.setpointC : null,
    });
  }
}

export const useAcademyStore = create<AcademyState>((set, get) => ({
  phase: "select",
  scenarioId: null,
  decisions: {},
  results: null,
  score: null,
  completed: {},

  openBriefing: (scenarioId) => {
    const scenario = getScenario(scenarioId);
    const decisions: Record<string, DeliveryDecision> = {};
    for (const d of suggestedDecisions(scenario)) decisions[d.deliveryId] = d;
    set({ phase: "briefing", scenarioId, decisions, results: null, score: null });
  },

  startOperate: () => {
    const { scenarioId, decisions } = get();
    if (!scenarioId) return;
    loadPlannedOntoMap(scenarioId, decisions);
    set({ phase: "operate" });
  },

  setDecision: (deliveryId, patch) => {
    const { scenarioId, decisions } = get();
    const current = decisions[deliveryId];
    if (!current) return;
    const next = { ...decisions, [deliveryId]: { ...current, ...patch } };
    set({ decisions: next });
    if (scenarioId) loadPlannedOntoMap(scenarioId, next); // keep the preview in sync
  },

  runDay: () => {
    const { scenarioId, decisions } = get();
    if (!scenarioId) return;
    const scenario = getScenario(scenarioId);
    // Authoritative headless score (deterministic, same seed as the animation).
    const run = simulateScenario(scenario, decisionsArray(decisions));
    const score = scoreScenario(scenario, run.results);
    set({ phase: "running", results: run.results, score });

    // Animate: the planned shipments are already on the map — just play.
    loadPlannedOntoMap(scenarioId, decisions);
    useColdgridStore.getState().play();
  },

  finishRun: () => {
    const { scenarioId, score, completed, phase } = get();
    if (phase !== "running" || !scenarioId || !score) return;
    useColdgridStore.getState().pause();
    const prev = completed[scenarioId];
    const best =
      !prev || score.composite > prev.composite
        ? { stars: score.stars, composite: score.composite }
        : prev;
    set({ phase: "result", completed: { ...completed, [scenarioId]: best } });
  },

  retry: () => {
    const { scenarioId } = get();
    if (scenarioId) get().openBriefing(scenarioId);
  },

  nextScenario: () => {
    const { scenarioId } = get();
    const idx = SCENARIOS.findIndex((s) => s.id === scenarioId);
    const next = SCENARIOS[idx + 1];
    if (next) get().openBriefing(next.id);
    else set({ phase: "select" });
    useColdgridStore.getState().resetSim();
  },

  backToSelect: () => {
    useColdgridStore.getState().resetSim();
    set({ phase: "select", scenarioId: null, results: null, score: null });
  },
}));
