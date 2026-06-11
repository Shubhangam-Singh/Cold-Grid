"use client";

/** A small concept explainer card (used in the assessment review). */
export default function ConceptCard({
  concept,
  text,
  correct,
}: {
  concept: string;
  text: string;
  correct: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        correct ? "border-emerald-900/60 bg-emerald-950/20" : "border-amber-900/60 bg-amber-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={correct ? "text-emerald-400" : "text-amber-400"}>{correct ? "✓" : "✕"}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-400">{concept}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}
