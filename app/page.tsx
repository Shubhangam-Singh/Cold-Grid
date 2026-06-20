import TwinScreen from "@/components/twin/TwinScreen";
import MetricsBar from "@/components/dashboard/MetricsBar";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-[#07090d]">
      {/* Control-room status bar */}
      <header className="relative z-50 flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4 glass-panel border-b-0 shadow-none bg-transparent">
        <div className="flex shrink-0 items-baseline gap-2 sm:gap-3">
          <span className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            ColdGrid
          </span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow animate-pulse-slow">
            Chennai Twin · Live
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
          <span className="hidden font-mono text-[11px] text-slate-400 lg:block">
            13.0827° N · 80.2707° E · Tamil Nadu
          </span>
          <Link
            href="/hardware"
            className="shrink-0 rounded-md border border-slate-600/50 bg-slate-800/40 px-2.5 sm:px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-slate-300 transition-all duration-300 hover:scale-105 hover:bg-slate-700/50 hover:text-white"
          >
            Hardware →
          </Link>
          <Link
            href="/ledger"
            className="shrink-0 rounded-md border border-twin-cyan/40 bg-twin-cyan/10 px-2.5 sm:px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-twin-cyan transition-all duration-300 hover:scale-105 hover:bg-twin-cyan/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            Trust Layer →
          </Link>
          <Link
            href="/academy"
            className="group relative shrink-0 overflow-hidden rounded-md border border-twin-amber/40 bg-twin-amber/10 px-2.5 sm:px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-twin-amber transition-all duration-300 hover:scale-105 hover:bg-twin-amber/20 hover:shadow-[0_0_15px_rgba(255,176,0,0.3)]"
          >
            <span className="relative z-10">Academy →</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-twin-amber/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </Link>
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
