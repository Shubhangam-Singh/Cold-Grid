import { describe, expect, it } from "vitest";
import { ASSESSMENT, countCorrect, scoreQuiz } from "./assessment";

describe("assessment", () => {
  it("has at least 4 questions, each with a valid correct index and a concept", () => {
    expect(ASSESSMENT.length).toBeGreaterThanOrEqual(4);
    for (const q of ASSESSMENT) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(q.concept.length).toBeGreaterThan(0);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it("question ids are unique", () => {
    const ids = new Set(ASSESSMENT.map((q) => q.id));
    expect(ids.size).toBe(ASSESSMENT.length);
  });

  it("scores 100% for all-correct and 0% for all-wrong", () => {
    const allCorrect: Record<string, number> = {};
    const allWrong: Record<string, number> = {};
    for (const q of ASSESSMENT) {
      allCorrect[q.id] = q.correctIndex;
      allWrong[q.id] = (q.correctIndex + 1) % q.options.length;
    }
    expect(scoreQuiz(allCorrect)).toBe(100);
    expect(scoreQuiz(allWrong)).toBe(0);
    expect(countCorrect(allCorrect)).toBe(ASSESSMENT.length);
  });

  it("partial credit is proportional", () => {
    const answers: Record<string, number> = {};
    ASSESSMENT.forEach((q, i) => {
      answers[q.id] = i === 0 ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
    });
    expect(scoreQuiz(answers)).toBeCloseTo((1 / ASSESSMENT.length) * 100, 6);
  });

  it("unanswered questions count as wrong", () => {
    expect(scoreQuiz({})).toBe(0);
  });
});
