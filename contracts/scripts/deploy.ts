import { ethers } from "hardhat";

/**
 * Deploy ColdChainAttestation + ComplianceEscrow to a local Hardhat node
 * (or a free testnet). No mainnet, ever.
 *
 *   npx hardhat node                      # terminal 1
 *   npm run deploy:local                  # terminal 2
 */
async function main() {
  const [admin] = await ethers.getSigners();
  console.log("Deployer:", admin.address);

  const att = await (await ethers.getContractFactory("ColdChainAttestation")).deploy(admin.address);
  await att.waitForDeployment();
  const attAddr = await att.getAddress();

  const escrow = await (
    await ethers.getContractFactory("ComplianceEscrow")
  ).deploy(attAddr, admin.address);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();

  console.log("ColdChainAttestation:", attAddr);
  console.log("ComplianceEscrow:    ", escrowAddr);
  console.log(
    "\nTo wire the app to the chain, set in coldgrid/.env.local:\n" +
      "  NEXT_PUBLIC_ENABLE_CHAIN=true\n" +
      `  NEXT_PUBLIC_CONTRACT_ADDRESS=${attAddr}\n` +
      "  NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
