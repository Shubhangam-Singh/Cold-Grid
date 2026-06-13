/**
 * Deterministic content hash for the simulated ledger.
 *
 * NOTE: production blockchains use keccak256 (see contracts/ColdChainAttestation.sol).
 * This is a fast, dependency-free, fully deterministic stand-in (cyrb53) used only
 * for the in-app demo so the chain hash-links and tamper-detects without pulling a
 * crypto library into the free-mode build (RULE 3) and replays identically (RULE 4).
 */
export function chainHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return "0x" + n.toString(16).padStart(14, "0");
}
