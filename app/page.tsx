import TwinScreen from "@/components/twin/TwinScreen";
import MetricsBar from "@/components/dashboard/MetricsBar";

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-[#07090d]">
      {/* Control-room status bar */}
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-slate-100">
            ColdGrid
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400">
            Chennai Twin · Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[11px] text-slate-500 sm:block">
            13.0827° N · 80.2707° E · Tamil Nadu
          </span>
          <a
            href="/academy"
            className="rounded-md border border-amber-700/60 bg-amber-950/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-amber-300 transition hover:bg-amber-900/40"
          >
            Academy →
          </a>
        </div>
      </header>

      {/* Dashboard KPI strip */}
      <MetricsBar />

      {/* The hero: live Chennai map */}
      <div className="relative flex-1">
        <TwinScreen />
      </div>
    </main>
  );
}
