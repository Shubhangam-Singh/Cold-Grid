import type { Metadata } from "next";
import AcademyApp from "@/components/academy/AcademyApp";

export const metadata: Metadata = {
  title: "ColdGrid Academy — Cold-Chain Operator Training",
  description:
    "Train as Chennai's cold-chain duty officer across five disaster-resilience scenarios, scored on food saved, on-time delivery, and carbon efficiency.",
};

export default function AcademyPage() {
  return <AcademyApp />;
}
