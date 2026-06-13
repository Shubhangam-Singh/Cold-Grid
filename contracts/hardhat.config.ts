import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

/**
 * ColdGrid Phase 9 — Hardhat config. Local node + free testnets only.
 * NEVER configure a mainnet network here: no mainnet, no real money (RULE-safe).
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    // `npx hardhat node` exposes this; deploy with --network localhost.
    localhost: { url: "http://127.0.0.1:8545" },
  },
};

export default config;
