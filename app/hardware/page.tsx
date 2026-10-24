import type { Metadata } from "next";
import Link from "next/link";
import LiveNodePanel from "@/components/hardware/LiveNodePanel";
import BrandByline from "@/components/BrandByline";

export const metadata: Metadata = {
  title: "ColdGrid — PPSC Hardware",
  description:
    "Connect a real PPSC cart into the fleet monitor: live temperature, humidity, and gas versus predicted remaining shelf life. Optional and free.",
};

export default function HardwarePage() {
  return (
    <main className="h-screen overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
              PPSC hardware
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-100">Connect a real PPSC cart into the fleet</h1>
            <BrandByline className="mt-2" />
          </div>
          <Link href="/" className="font-mono text-[11px] text-slate-500 transition hover:text-twin-cyan">
            ← Fleet
          </Link>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Each truck on the fleet map carries a PPSC unit (DHT22 temperature/humidity + MQ-135 gas).
          Here you can plug in a real cart over serial and watch the same spoilage model turn live
          cargo temperature into remaining shelf life. Optional and free — leave the cart toggle
          off and this panel shows a synthetic afternoon baseline like every other truck.
        </p>

        <div className="mt-6">
          <LiveNodePanel />
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-relaxed text-slate-400">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Enable the live PPSC</div>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              <code className="text-slate-300">cd bridge &amp;&amp; pip install -r requirements.txt</code>
            </li>
            <li>
              <code className="text-slate-300">python coldgrid_bridge.py --port COM12</code> (115200 baud).
              Use <code className="text-slate-300">--mock</code> with no cart.
            </li>
            <li>
              On this page, turn <span className="text-slate-300">Real PPSC readings</span> on.
              The fleet Operations panel has the same switch. No restart. While a frame is
              fresh, the newest truck on the map uses the cart temperature instead of city ambient.
            </li>
            <li>
              Optional: <code className="text-slate-300">NEXT_PUBLIC_ENABLE_HARDWARE=true</code> starts
              that switch on, and <code className="text-slate-300">NEXT_PUBLIC_WS_URL</code> overrides{" "}
              <code className="text-slate-300">ws://localhost:8765</code>.
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
