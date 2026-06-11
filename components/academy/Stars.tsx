"use client";

/** 1–3 star rating with an accessible label. */
export default function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${value} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= value ? "text-amber-400" : "text-slate-700"}>
          ★
        </span>
      ))}
    </span>
  );
}
