import type { Metadata } from "next";
import Link from "next/link";
import CitizenMode from "@/components/learning/CitizenMode";

export const metadata: Metadata = {
  title: "ColdGrid — Citizen Mode",
  description:
    "The Chennai cold-chain simulation for everyone. One choice — cost vs food safety — and you see, in plain English, why your vegetables sometimes arrive spoiled.",
};

export default function CitizenPage() {
  return (
    <main className="min-h-screen overflow-y-auto bg-[#07090d] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-lg">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-twin-cyan text-glow">
              Citizen Mode
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-100">No dials. No jargon. One choice.</h1>
          </div>
          <Link href="/" className="font-mono text-[11px] text-slate-500 transition hover:text-twin-cyan">
            ← Twin
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <CitizenMode />
      </div>

      <p className="mx-auto mt-6 max-w-lg text-center text-[11px] leading-relaxed text-slate-600">
        Same physics as the operator twin — the patented PPSC Adaptive Arrhenius + EMA engine — just
        with everything but the one decision that matters hidden away.
      </p>
    </main>
  );
}
