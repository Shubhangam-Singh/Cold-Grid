"use client";

/**
 * The pre/post knowledge assessment (spec §7.3). The same questions are taken
 * before and after training; the score feeds the certificate's learning-gain
 * delta. After submitting, a review shows the correct answers as concept cards.
 */

import { useState } from "react";
import { ASSESSMENT, scoreQuiz } from "@/lib/academy/assessment";
import { useAcademyStore } from "@/store/academyStore";
import ConceptCard from "./ConceptCard";

export default function QuizModal({ mode }: { mode: "pre" | "post" }) {
  const submitAssessment = useAcademyStore((s) => s.submitAssessment);
  const backToSelect = useAcademyStore((s) => s.backToSelect);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [reviewing, setReviewing] = useState(false);

  const allAnswered = ASSESSMENT.every((q) => answers[q.id] != null);
  const score = scoreQuiz(answers);

  return (
    <div className="flex h-full w-full items-start justify-center overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-950/90 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-400">
          {mode === "pre" ? "Pre-training assessment" : "Post-training assessment"}
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-100">
          {reviewing ? "Review" : "What do you know about the cold chain?"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {reviewing
            ? `You scored ${score.toFixed(0)}%. Here's the reasoning behind each answer.`
            : "Answer honestly — you'll take the same quiz again after training to measure what you learned."}
        </p>

        {!reviewing ? (
          <>
            <ol className="mt-4 space-y-4">
              {ASSESSMENT.map((q, qi) => (
                <li key={q.id} className="rounded-lg bg-slate-900/60 p-3">
                  <div className="text-sm font-medium text-slate-200">
                    {qi + 1}. {q.question}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition ${
                          answers[q.id] === oi ? "bg-sky-950/60 text-slate-100" : "text-slate-300 hover:bg-slate-800/60"
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          className="accent-sky-400"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex items-center justify-between">
              <button onClick={backToSelect} className="text-xs text-slate-500 hover:text-slate-300">
                ← Cancel
              </button>
              <button
                onClick={() => setReviewing(true)}
                disabled={!allAnswered}
                className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
              >
                Submit ({Object.keys(answers).length}/{ASSESSMENT.length})
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {ASSESSMENT.map((q) => (
                <ConceptCard
                  key={q.id}
                  concept={q.concept}
                  text={`${q.explanation}${
                    answers[q.id] !== q.correctIndex ? ` (Correct: “${q.options[q.correctIndex]}”.)` : ""
                  }`}
                  correct={answers[q.id] === q.correctIndex}
                />
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => submitAssessment(mode, answers)}
                className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                {mode === "pre" ? "Start training →" : "See my certificate →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
