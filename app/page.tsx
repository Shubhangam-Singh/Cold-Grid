import TwinScreen from "@/components/twin/TwinScreen";

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
            Chennai Twin
          </span>
        </div>
        <div className="hidden font-mono text-[11px] text-slate-500 sm:block">
          13.0827° N · 80.2707° E · Tamil Nadu
        </div>
      </header>

      {/* The hero: live Chennai map */}
      <div className="relative flex-1">
        <TwinScreen />
      </div>
    </main>
  );
}
