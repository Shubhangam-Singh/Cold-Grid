"use client";

/**
 * Runtime switch for the real PPSC cart. Off (the default) leaves every
 * truck on synthetic sensors. On, a fresh frame drives the newest truck.
 */

import { useLiveHardwareStore } from "@/store/liveHardwareStore";

export default function CartToggle({ compact = false }: { compact?: boolean }) {
  const listen = useLiveHardwareStore((s) => s.listen);
  const connected = useLiveHardwareStore((s) => s.connected);
  const setListen = useLiveHardwareStore((s) => s.setListen);
  const label = !listen ? "Read cart" : connected ? "Cart live" : "Cart waiting";

  return (
    <button
      type="button"
      onClick={() => setListen(!listen)}
      aria-pressed={listen}
      className={
        compact
          ? `rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan ${
              listen
                ? "border border-twin-cyan/50 bg-twin-cyan/20 text-twin-cyan"
                : "border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
            }`
          : `flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-twin-cyan ${
              listen ? "border-twin-cyan/40 bg-twin-cyan/10" : "border-slate-800 bg-slate-950/60"
            }`
      }
    >
      <span className={compact ? "" : "font-mono text-[10px] uppercase tracking-[0.16em] text-slate-300"}>
        {compact ? label : "Real PPSC readings"}
      </span>
      {!compact && (
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
            listen ? "bg-twin-cyan/20 text-twin-cyan" : "bg-slate-800 text-slate-400"
          }`}
        >
          {listen ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}
