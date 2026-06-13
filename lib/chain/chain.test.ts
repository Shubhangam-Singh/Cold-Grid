import { describe, expect, it } from "vitest";
import {
  ATTESTER_ROLE,
  RoleError,
  buildAttestations,
  countBreaches,
} from "./attestation";
import { appendAttestation, buildChain, tamperReportedTemp, verifyChain } from "./ledger";
import { settle } from "./escrow";
import { DEMO_TERMS, buildTrustArc, sampleShipmentHistory } from "./arc";
import type { TempAttestation } from "./types";

const history = sampleShipmentHistory("fish");

function honestTrace(): TempAttestation[] {
  return buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter" });
}

describe("ledger hash-linking & tamper detection", () => {
  it("builds a linked chain whose every block verifies", () => {
    const chain = buildChain(honestTrace());
    expect(chain.length).toBe(honestTrace().length);
    expect(chain[0].prevHash).toBe("0x0");
    for (let i = 1; i < chain.length; i++) {
      expect(chain[i].prevHash).toBe(chain[i - 1].hash);
    }
    expect(verifyChain(chain).intact).toBe(true);
  });

  it("detects tampering with a sealed block", () => {
    const chain = buildChain(honestTrace());
    const tampered = tamperReportedTemp(chain, 2, -10); // forge a cold reading
    const result = verifyChain(tampered);
    expect(result.intact).toBe(false);
    expect(result.brokenAtIndex).toBe(2);
  });

  it("is deterministic — identical traces produce identical hashes", () => {
    expect(buildChain(honestTrace())).toEqual(buildChain(honestTrace()));
  });

  it("appendAttestation is pure (does not mutate the input chain)", () => {
    const chain = buildChain(honestTrace());
    const len = chain.length;
    const next = appendAttestation(chain, honestTrace()[0]);
    expect(chain.length).toBe(len);
    expect(next.length).toBe(len + 1);
  });
});

describe("role-gated attestation", () => {
  it("only the transporter role may attest", () => {
    expect(ATTESTER_ROLE).toBe("transporter");
    expect(() =>
      buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "retailer" })
    ).toThrow(RoleError);
  });

  it("cheating under-reports breaches vs the truth", () => {
    const honest = buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter" });
    const cheat = buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter", cheat: true });
    const trueBreaches = countBreaches(honest, true);
    expect(trueBreaches).toBeGreaterThan(0); // the warming run really did breach
    expect(countBreaches(honest, false)).toBe(trueBreaches); // honest reports = truth
    expect(countBreaches(cheat, false)).toBe(0); // cheat reports zero
  });
});

describe("escrow settlement contrasts trust models", () => {
  it("off-chain trust pays a cheater in full and misses the fraud", () => {
    const cheat = buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter", cheat: true });
    const s = settle({ mode: "off-chain-trust", terms: DEMO_TERMS, attestations: cheat });
    expect(s.payoutRupees).toBe(DEMO_TERMS.paymentRupees); // full pay despite spoilage
    expect(s.fraudDetected).toBe(true);
  });

  it("on-chain settles on the oracle truth and withholds the penalty", () => {
    const cheat = buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter", cheat: true });
    const chain = buildChain(cheat);
    const s = settle({ mode: "on-chain", terms: DEMO_TERMS, attestations: cheat, chain });
    expect(s.breachesUsed).toBe(countBreaches(cheat, true));
    expect(s.payoutRupees).toBeLessThan(DEMO_TERMS.paymentRupees);
    expect(s.chainIntact).toBe(true);
  });

  it("on-chain refuses payment if the ledger was tampered with", () => {
    const cheat = buildAttestations({ shipmentId: "S1", produce: "fish", history, postedBy: "transporter", cheat: true });
    const tampered = tamperReportedTemp(buildChain(cheat), 1, -5);
    const s = settle({ mode: "on-chain", terms: DEMO_TERMS, attestations: cheat, chain: tampered });
    expect(s.chainIntact).toBe(false);
    expect(s.payoutRupees).toBe(0);
  });
});

describe("trust arc", () => {
  it("tells the no-trust → cheating → on-chain story with escalating consequences", () => {
    const arc = buildTrustArc({});
    expect(arc.map((a) => a.id)).toEqual(["off-chain-honest", "off-chain-cheat", "on-chain"]);
    const [, cheatStage, onChainStage] = arc;
    // Cheating off-chain: full payout, fraud invisible.
    expect(cheatStage.settlement.payoutRupees).toBe(DEMO_TERMS.paymentRupees);
    // On-chain: less than full, fraud neutralized.
    expect(onChainStage.settlement.payoutRupees).toBeLessThan(cheatStage.settlement.payoutRupees);
  });

  it("is deterministic", () => {
    expect(buildTrustArc({})).toEqual(buildTrustArc({}));
  });
});
