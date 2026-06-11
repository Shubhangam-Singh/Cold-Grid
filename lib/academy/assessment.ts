/**
 * Pre/post knowledge assessment (spec §7.3). PURE.
 *
 * The SAME questions are taken before the first scenario and after the last;
 * the score delta is the measurable-learning evidence shown on the certificate.
 * Each question ties to a concept the scenarios teach (see conceptTags).
 */

export interface QuizQuestion {
  id: string;
  concept: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const ASSESSMENT: QuizQuestion[] = [
  {
    id: "q-arrhenius",
    concept: "arrhenius-q10",
    question:
      "A produce item's spoilage follows Arrhenius kinetics. Roughly how does a 10 °C rise in temperature change its spoilage rate?",
    options: [
      "It barely changes (a few percent)",
      "It roughly doubles to triples (the Q10 effect)",
      "It always exactly doubles, for every food",
      "It decreases — warmer food lasts longer",
    ],
    correctIndex: 1,
    explanation:
      "Arrhenius/Q10: each ~10 °C typically multiplies the reaction rate by ~2–3×. The exact factor depends on the activation energy, which differs per produce.",
  },
  {
    id: "q-cold-chain",
    concept: "cold-chain",
    question: "What is the core purpose of an unbroken cold chain?",
    options: [
      "To freeze all produce solid for transport",
      "To keep temperature low and stable so spoilage kinetics stay slow end-to-end",
      "To make trucks cheaper to run",
      "To add humidity to the cargo",
    ],
    correctIndex: 1,
    explanation:
      "A cold chain holds produce in its safe temperature band from source to shelf, keeping the spoilage rate low at every hop — one warm gap can undo the whole journey.",
  },
  {
    id: "q-ema-inertia",
    concept: "thermal-inertia",
    question:
      "ColdGrid's engine has a thermal-memory (EMA) term. What does it capture that a simple instantaneous-temperature model misses?",
    options: [
      "The price of diesel",
      "That accumulated heat exposure keeps damaging cargo even after it is re-cooled",
      "The GPS position of the truck",
      "Nothing — it is the same as instantaneous temperature",
    ],
    correctIndex: 1,
    explanation:
      "Thermal history matters: a batch that was heat-stressed carries that 'memory', so it keeps degrading faster for a while even once the temperature drops again.",
  },
  {
    id: "q-food-mile-co2",
    concept: "food-mile-co2",
    question:
      "You refrigerate a truck harder (a colder setpoint) on a hot day. What is the main tradeoff?",
    options: [
      "There is no tradeoff — colder is always strictly better",
      "It saves food but the compressor burns more energy and emits more CO₂",
      "It emits less CO₂ because the food is colder",
      "It makes the truck travel faster",
    ],
    correctIndex: 1,
    explanation:
      "Cooling against a hot ambient costs compressor energy (and CO₂). Good operators cool enough to protect the cargo without needlessly over-cooling.",
  },
  {
    id: "q-equity-waste",
    concept: "equity-waste",
    question: "Why is cold-chain food waste an equity and sustainability issue, not just a cost?",
    options: [
      "It isn't — it only affects company profit",
      "Spoiled food wastes the water, land, energy and labour that produced it, and removes affordable food from a city's supply",
      "Because refrigerators are expensive to buy",
      "Because it makes markets look untidy",
    ],
    correctIndex: 1,
    explanation:
      "Every spoiled shipment wastes all the upstream resources used to grow and move it, and shrinks the affordable, nutritious food available to a city — a sustainability and food-security loss.",
  },
];

/** Percent correct (0–100) for a set of answers keyed by question id. */
export function scoreQuiz(answers: Record<string, number>): number {
  if (ASSESSMENT.length === 0) return 0;
  const correct = ASSESSMENT.reduce(
    (n, q) => n + (answers[q.id] === q.correctIndex ? 1 : 0),
    0
  );
  return (correct / ASSESSMENT.length) * 100;
}

/** Number of correct answers. */
export function countCorrect(answers: Record<string, number>): number {
  return ASSESSMENT.reduce((n, q) => n + (answers[q.id] === q.correctIndex ? 1 : 0), 0);
}
