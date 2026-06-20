import type { Metadata } from "next";
import Link from "next/link";
import LiveNodePanel from "@/components/hardware/LiveNodePanel";

export const metadata: Metadata = {
  title: "ColdGrid — Hardware in the Loop",
  description:
    "The real PPSC smart cart as a live node inside the Chennai twin: the patented engine's predicted shelf life vs the cart's actual sensor data, in real time. Optional and free.",
};

export default function HardwarePage() {
  return (
    <main className="h-screen overflow-y-auto bg-[#07090d] px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
              Hardware in the loop
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-100">The real PPSC cart as a live node</h1>
          </div>
          <Link href="/" className="font-mono text-[11px] text-slate-500 transition hover:text-twin-cyan">
            ← Twin
          </Link>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          ColdGrid scales the patented PPSC engine from one cart to a city. Here it closes the loop the other
          way: a real cart&apos;s sensors stream into one twin node, and the same engine that predicts the whole
          city&apos;s freshness predicts this node&apos;s — live. Optional and free; with hardware off, the node
          shows a synthetic baseline like every other node.
        </p>

        <div className="mt-6">
          <LiveNodePanel />
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs leading-relaxed text-slate-400">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Enable the live node</div>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              <code className="text-slate-300">cd bridge &amp;&amp; pip install -r requirements.txt</code>
            </li>
            <li>
              <code className="text-slate-300">python coldgrid_bridge.py --port COM3</code> (or{" "}
              <code className="text-slate-300">--mock</code> to test without hardware)
            </li>
            <li>
              In <code className="text-slate-300">.env.local</code>: set{" "}
              <code className="text-slate-300">NEXT_PUBLIC_ENABLE_HARDWARE=true</code> and{" "}
              <code className="text-slate-300">NEXT_PUBLIC_WS_URL=ws://localhost:8765</code>, then restart.
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
