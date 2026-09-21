/** Quiet credit under the wordmark. In-flow — never overlaid on the map. */
export default function BrandByline({ className = "" }: { className?: string }) {
  return (
    <p
      className={`font-mono text-[9px] leading-none tracking-[0.2em] text-slate-500 sm:text-[10px] ${className}`}
    >
      By <span className="text-slate-200">Shubhangam Singh</span>
    </p>
  );
}
