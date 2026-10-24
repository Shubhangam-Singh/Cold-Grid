/**
 * Posts PPSC temperatures to a local ColdChainAttestation contract.
 *
 * Reads JSON readings on stdin (the Python bridge). Posts only when
 * attestPolicy says to. Never used for mainnet. A localhost RPC with no
 * keys falls back to Hardhat's public test accounts (account 0 admin,
 * account 1 transporter).
 *
 *   COLDGRID_RPC_URL=http://127.0.0.1:8545
 *   COLDGRID_ATTESTATION_ADDRESS=0x...
 *   COLDGRID_SHIPMENT_ID=PPSC-LIVE
 *   COLDGRID_THRESHOLD_CENTI=2500
 */

import { createRequire } from "module";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { emptyAttestCursor, shouldAttest } from "./attestPolicy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../contracts/package.json"));
const { ethers } = require("ethers");

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";
const rpcUrl = process.env.COLDGRID_RPC_URL || "http://127.0.0.1:8545";
const address = process.env.COLDGRID_ATTESTATION_ADDRESS || "";
const shipmentName = process.env.COLDGRID_SHIPMENT_ID || "PPSC-LIVE";
const thresholdCenti = BigInt(process.env.COLDGRID_THRESHOLD_CENTI || "2500");

const ABI = [
  "function grantRole(bytes32 role, address account)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function TRANSPORTER_ROLE() view returns (bytes32)",
  "function setThreshold(bytes32 shipmentId, int256 thresholdCentiC)",
  "function attest(bytes32 shipmentId, int256 tempCentiC)",
];

function isLocal(url) {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function walletFrom(keyOrNull, index) {
  if (keyOrNull) return new ethers.Wallet(keyOrNull);
  if (!isLocal(rpcUrl)) {
    throw new Error("Set COLDGRID_ADMIN_KEY and COLDGRID_TRANSPORTER_KEY for a non-local RPC");
  }
  const path = `m/44'/60'/0'/0/${index}`;
  return ethers.HDNodeWallet.fromPhrase(HARDHAT_MNEMONIC, undefined, path);
}

async function main() {
  if (!address) {
    console.error("[chain] set COLDGRID_ATTESTATION_ADDRESS from npm run deploy:local");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const admin = walletFrom(process.env.COLDGRID_ADMIN_KEY || "", 0).connect(provider);
  const transporter = walletFrom(process.env.COLDGRID_TRANSPORTER_KEY || "", 1).connect(provider);
  const att = new ethers.Contract(address, ABI, admin);
  const shipmentId = ethers.id(shipmentName);
  const role = await att.TRANSPORTER_ROLE();
  // Hardhat automine can hand two back-to-back admin txs the same nonce.
  let adminNonce = await provider.getTransactionCount(admin.address);
  if (!(await att.hasRole(role, transporter.address))) {
    const grant = await att.grantRole(role, transporter.address, { nonce: adminNonce });
    adminNonce += 1;
    await grant.wait();
    console.error(`[chain] granted TRANSPORTER_ROLE to ${transporter.address}`);
  }
  const set = await att.setThreshold(shipmentId, thresholdCenti, { nonce: adminNonce });
  await set.wait();
  console.error(
    `[chain] ready ${shipmentName} threshold ${thresholdCenti.toString()} centi-°C via ${transporter.address}`
  );

  const writer = att.connect(transporter);
  let cursor = emptyAttestCursor();
  let txNonce = await provider.getTransactionCount(transporter.address);
  const thresholdC = Number(thresholdCenti) / 100;
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;
    let reading;
    try {
      reading = JSON.parse(text);
    } catch {
      continue;
    }
    const tempC = Number(reading.tempC);
    const at = Number(reading.at);
    if (!Number.isFinite(tempC) || !Number.isFinite(at)) continue;
    const decision = shouldAttest(cursor, { tempC, at }, thresholdC);
    cursor = decision.next;
    if (!decision.post) continue;
    try {
      const centi = BigInt(Math.round(tempC * 100));
      const tx = await writer.attest(shipmentId, centi, { nonce: txNonce });
      const receipt = await tx.wait();
      txNonce += 1;
      console.log(JSON.stringify({ tx: receipt.hash, tempC, reason: decision.reason }));
    } catch (err) {
      console.error(`[chain] attest failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(`[chain] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
