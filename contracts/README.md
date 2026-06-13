# ColdGrid Contracts — Phase 9 Trust Layer

Real Solidity twins of the in-app simulated ledger (`lib/chain/`). **Isolated, optional, and a separate npm package** — the main ColdGrid app builds, runs, and demos with zero dependency on anything here (`NEXT_PUBLIC_ENABLE_CHAIN=false`).

> ⚠️ **Local Hardhat node and free testnets only. No mainnet, no real money — ever.**

## Contracts

- **`ColdChainAttestation.sol`** — role-gated temperature attestation (OpenZeppelin `AccessControl`: `FARMER` / `TRANSPORTER` / `RETAILER` / `AUDITOR`). Only a `TRANSPORTER` may post readings; each reading over the shipment threshold increments a public, tamper-proof `breachCount`. In production the oracle is a network like Chainlink; in ColdGrid it's the simulation.
- **`ComplianceEscrow.sol`** — a buyer funds an escrow per shipment; `settleDelivery` reads the on-chain breach count and automatically pays the supplier minus a per-breach penalty (refunded to the buyer). Trustless, automatic enforcement.

## Run it

```bash
cd contracts
npm install
npm test            # compiles + runs the Hardhat test suite

# Optional: live on a local node, then point the app at it
npm run node                  # terminal 1 — local chain on :8545
npm run deploy:local          # terminal 2 — prints the contract addresses
# then in coldgrid/.env.local:
#   NEXT_PUBLIC_ENABLE_CHAIN=true
#   NEXT_PUBLIC_CONTRACT_ADDRESS=<ColdChainAttestation address>
#   NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

The app's `lib/chain/onchain.ts` lazily loads `ethers` and reads `breachCountByName(...)` only when the flag is on; otherwise everything uses the free simulated ledger.
