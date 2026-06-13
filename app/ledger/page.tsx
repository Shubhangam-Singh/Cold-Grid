import type { Metadata } from "next";
import LedgerApp from "@/components/chain/LedgerApp";

export const metadata: Metadata = {
  title: "ColdGrid — Trust Layer (Blockchain Attestation)",
  description:
    "Why tamper-proof cold-chain records matter: a no-trust → cheating-exposed → on-chain-enforcement walkthrough, powered by the ColdGrid simulated ledger.",
};

export default function LedgerPage() {
  return (
    <main className="h-screen bg-[#07090d]">
      <LedgerApp />
    </main>
  );
}
