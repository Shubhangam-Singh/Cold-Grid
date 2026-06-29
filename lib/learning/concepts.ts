/**
 * The five core concepts ColdGrid teaches, as contextual pop-up cards. Each is
 * triggered the first time the learner hits the moment it explains (see
 * ConceptWatcher), so the idea lands exactly when it's relevant. PURE data.
 */

export interface ConceptCardData {
  id: string;
  name: string;
  icon: string;
  /** One plain-English sentence. */
  sentence: string;
  /** One concrete Chennai example. */
  chennaiExample: string;
}

export const CONCEPTS: Record<string, ConceptCardData> = {
  arrhenius: {
    id: "arrhenius",
    name: "Arrhenius / Q10",
    icon: "🌡",
    sentence:
      "Spoilage isn't linear — every ~10 °C of extra heat roughly doubles to triples how fast food decays.",
    chennaiExample:
      "Fish landed cold at Kasimedu can be near-spoiled just from crossing a 35 °C market street.",
  },
  ema: {
    id: "ema",
    name: "EMA thermal memory",
    icon: "🧠",
    sentence:
      "Heat damage sticks: cargo that was warmed keeps degrading faster for a while even after you re-cool it.",
    chennaiExample:
      "A reefer that failed for 20 minutes in Chennai traffic carries that 'thermal debt' for the rest of the trip.",
  },
  uhi: {
    id: "uhi",
    name: "Urban heat island",
    icon: "🏙",
    sentence:
      "Dense concrete city zones run 3–5 °C hotter than the regional average — extra heat your cargo must survive.",
    chennaiExample:
      "T. Nagar's concrete canyons bake hotter than the coast at Adyar, so the same load decays faster there.",
  },
  tradeoff: {
    id: "tradeoff",
    name: "Cold vs grid tradeoff",
    icon: "⚡",
    sentence:
      "Refrigerating harder protects food but burns more energy and CO₂ — cooling is never free.",
    chennaiExample:
      "On a 40 °C Chennai afternoon, every degree colder you hold a reefer spikes the compressor's grid draw.",
  },
  equity: {
    id: "equity",
    name: "Food miles & equity",
    icon: "🌱",
    sentence:
      "Every spoiled load wastes all the water, land and fuel that produced it — and removes affordable food from the city.",
    chennaiExample:
      "A spoiled vegetable truck pushes up market prices for the Chennai families least able to absorb them.",
  },
};
