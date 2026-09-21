import type { Metadata } from "next";
import AcademyApp from "@/components/academy/AcademyApp";

export const metadata: Metadata = {
  title: "ColdGrid Academy — Operator Training",
  description:
    "Optional operator practice: five crisis scenarios on the same PPSC fleet, scored on food saved, on-time delivery, and energy.",
};

export default function AcademyPage() {
  return <AcademyApp />;
}
