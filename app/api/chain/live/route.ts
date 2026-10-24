/**
 * Read the local attestation contract for PPSC-LIVE.
 * With the chain flag off this returns immediately and touches no RPC.
 */

import { chainConfig } from "@/lib/chain/onchain";
import { loadEthers } from "@/lib/chain/loadEthers";
import { LIVE_SHIPMENT_ID } from "@/lib/hardware/liveSession";
import type { LiveChainStatus } from "@/lib/chain/liveStatus";

export const dynamic = "force-dynamic";

const ABI = [
  "function breachCountByName(string name) view returns (uint256)",
  "event TemperatureAttested(bytes32 indexed shipmentId, int256 tempCentiC, bool breach, address indexed by)",
];

export async function GET() {
  const cfg = chainConfig();
  if (!cfg.enabled || !cfg.contractAddress) {
    return Response.json({ enabled: false } satisfies LiveChainStatus);
  }

  const ethers = loadEthers();
  if (!ethers) {
    return Response.json({
      enabled: true,
      reachable: false,
      shipmentId: LIVE_SHIPMENT_ID,
      error: "ethers is not installed in contracts/",
    } satisfies LiveChainStatus);
  }

  try {
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const contract = new ethers.Contract(cfg.contractAddress, ABI, provider);
    const breaches: bigint = await contract.breachCountByName(LIVE_SHIPMENT_ID);
    const shipmentKey = ethers.id(LIVE_SHIPMENT_ID);
    const logs = await contract.queryFilter(contract.filters.TemperatureAttested(shipmentKey), 0);
    const last = logs.length > 0 ? logs[logs.length - 1] : null;
    const body: LiveChainStatus = {
      enabled: true,
      reachable: true,
      shipmentId: LIVE_SHIPMENT_ID,
      breachCount: Number(breaches),
      lastTxHash: last ? last.transactionHash : null,
      lastTempC: last?.args?.tempCentiC != null ? Number(last.args.tempCentiC) / 100 : null,
    };
    return Response.json(body);
  } catch (err) {
    return Response.json({
      enabled: true,
      reachable: false,
      shipmentId: LIVE_SHIPMENT_ID,
      error: err instanceof Error ? err.message : "RPC failed",
    } satisfies LiveChainStatus);
  }
}
