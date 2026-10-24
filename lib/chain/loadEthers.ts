/**
 * Server-only. ethers stays in the contracts workspace so the free-mode
 * Next build does not depend on it. Returns null when that workspace has
 * not been installed.
 */

import { createRequire } from "module";
import path from "path";

/** The slice of ethers v6 the live-chain route actually calls. */
export interface LoadedEthers {
  JsonRpcProvider: new (url: string) => object;
  Contract: new (address: string, abi: readonly string[], provider: object) => LiveAttestationContract;
  id(value: string): string;
}

interface AttestedLog {
  transactionHash: string;
  args?: { tempCentiC?: bigint | number | null };
}

interface LiveAttestationContract {
  breachCountByName(name: string): Promise<bigint>;
  filters: { TemperatureAttested(shipmentId: string): unknown };
  queryFilter(filter: unknown, fromBlock: number): Promise<AttestedLog[]>;
}

export function loadEthers(): LoadedEthers | null {
  try {
    const require = createRequire(path.join(process.cwd(), "contracts", "package.json"));
    return require("ethers") as LoadedEthers;
  } catch {
    return null;
  }
}
