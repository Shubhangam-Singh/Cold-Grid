/**
 * Flag-gated on-chain wrapper (Phase 9). With NEXT_PUBLIC_ENABLE_CHAIN=false
 * (the default, RULE 3) the app NEVER touches a real chain — it uses the
 * simulated ledger in this folder. When the flag is true AND a contract address
 * is set, this lazily loads ethers (only present in the /contracts workspace)
 * and talks to the deployed ColdChainAttestation / ComplianceEscrow on a local
 * Hardhat node or a free testnet. ethers is dynamically imported so it is never
 * bundled into the default free-mode build.
 */

export interface ChainConfig {
  enabled: boolean;
  contractAddress: string | null;
  rpcUrl: string;
}

export function chainConfig(): ChainConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_ENABLE_CHAIN === "true",
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? null,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545",
  };
}

/** True only when the operator has explicitly enabled a real chain + address. */
export function isOnChainEnabled(): boolean {
  const cfg = chainConfig();
  return cfg.enabled && !!cfg.contractAddress;
}

/**
 * Post the on-chain breach count for a shipment, if the chain is enabled.
 * Returns null in free mode (the caller falls back to the simulated ledger).
 * ethers is imported lazily so the default build stays dependency-free.
 */
export async function readOnChainBreaches(shipmentId: string): Promise<number | null> {
  const cfg = chainConfig();
  if (!cfg.enabled || !cfg.contractAddress) return null;
  try {
    // Lazy import — only resolves when the developer has installed ethers
    // (it lives in the /contracts workspace, not the main app).
    const ethers = await import(/* webpackIgnore: true */ "ethers" as string);
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const abi = [
      "function breachCountByName(string name) view returns (uint256)",
    ];
    const contract = new ethers.Contract(cfg.contractAddress, abi, provider);
    const count: bigint = await contract.breachCountByName(shipmentId);
    return Number(count);
  } catch {
    // ethers missing or node unreachable → fall back to the simulated ledger.
    return null;
  }
}
