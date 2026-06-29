/**
 * Tiny store for contextual concept cards — decoupled from the sim and academy
 * stores so it can be driven from either. Each concept pops at most once; a new
 * trigger is ignored while a card is already showing (no stacking).
 */

import { create } from "zustand";
import { CONCEPTS } from "@/lib/learning/concepts";

interface LearningState {
  seen: Record<string, boolean>;
  pendingId: string | null;
  trigger: (id: string) => void;
  dismiss: () => void;
  resetConcepts: () => void;
}

export const useLearningStore = create<LearningState>((set, get) => ({
  seen: {},
  pendingId: null,
  trigger: (id) => {
    const { seen, pendingId } = get();
    if (!CONCEPTS[id] || seen[id] || pendingId) return;
    set({ pendingId: id, seen: { ...seen, [id]: true } });
  },
  dismiss: () => set({ pendingId: null }),
  resetConcepts: () => set({ seen: {}, pendingId: null }),
}));
