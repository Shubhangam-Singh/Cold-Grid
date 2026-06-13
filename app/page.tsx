import TwinScreen from "@/components/twin/TwinScreen";
import MetricsBar from "@/components/dashboard/MetricsBar";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex h-screen flex-col bg-[#07090d]">
      {/* Control-room status bar */}
      <header className="relative z-50 flex items-center justify-between px-6 py-4 glass-panel border-b-0 shadow-none bg-transparent">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            ColdGrid
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow animate-pulse-slow">
            Chennai Twin · Live
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="hidden font-mono text-[11px] text-slate-400 sm:block">
            13.0827° N · 80.2707° E · Tamil Nadu
          </span>
          <Link
            href="/ledger"
            className="rounded-md border border-twin-cyan/40 bg-twin-cyan/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-twin-cyan transition-all duration-300 hover:scale-105 hover:bg-twin-cyan/20 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)]"
          >
            Trust Layer →
          </Link>
          <Link
            href="/academy"
            className="group relative overflow-hidden rounded-md border border-twin-amber/40 bg-twin-amber/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-twin-amber transition-all duration-300 hover:scale-105 hover:bg-twin-amber/20 hover:shadow-[0_0_15px_rgba(255,176,0,0.3)]"
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
