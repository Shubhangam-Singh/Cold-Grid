/**
 * Labelled traces for detector checks.
 * simulated: true marks every row. These rows never enter the fleet store.
 */

import { buildChain, tamperReportedTemp } from "../chain/ledger";
import type { LedgerBlock } from "../chain/types";

export interface LabelledTrace {
  simulated: true;
  name: string;
  temps: number[];
  thresholdC: number;
  excursion: boolean;
  fault: boolean;
}

export interface LabelledLedger {
  simulated: true;
  name: string;
  blocks: LedgerBlock[];
  tamper: boolean;
}

export function labelledTraces(): LabelledTrace[] {
  return [
    { simulated: true, name: "door-spike", temps: [22, 23, 24, 36], thresholdC: 30, excursion: true, fault: true },
    { simulated: true, name: "reefer-fail", temps: [4, 6, 12, 18, 28, 33], thresholdC: 30, excursion: true, fault: false },
    { simulated: true, name: "cool-hold", temps: [4, 4.2, 4.1, 4.3, 4.2, 4.4], thresholdC: 30, excursion: false, fault: false },
    { simulated: true, name: "flatline", temps: [21, 21, 21, 21, 21, 21], thresholdC: 30, excursion: false, fault: true },
    { simulated: true, name: "city-warm", temps: [28, 29, 29.5, 30], thresholdC: 30, excursion: false, fault: false },
  ];
}

export function labelledLedgers(): LabelledLedger[] {
  const intact = buildChain([
    { shipmentId: "SIM", seq: 0, reportedTempC: 24, trueTempC: 24, thresholdC: 25, postedBy: "transporter" },
    { shipmentId: "SIM", seq: 1, reportedTempC: 24.4, trueTempC: 24.4, thresholdC: 25, postedBy: "transporter" },
  ]);
  return [
    { simulated: true, name: "intact", blocks: intact, tamper: false },
    { simulated: true, name: "edited-temp", blocks: tamperReportedTemp(intact, 1, 40), tamper: true },
  ];
}
