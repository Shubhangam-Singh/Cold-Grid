export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">
        Phase 0 — Scaffold online
      </p>
      <h1 className="text-5xl font-bold tracking-tight">ColdGrid</h1>
      <p className="max-w-xl text-center text-sm leading-relaxed text-slate-400">
        A digital twin of Chennai&apos;s perishable-food cold chain with an
        operator training academy — powered by the patented PPSC Adaptive
        Arrhenius + EMA spoilage engine.
      </p>
      <div className="font-mono text-xs text-slate-500">
        13.0827° N, 80.2707° E · Chennai, Tamil Nadu
      </div>
    </main>
  );
}
