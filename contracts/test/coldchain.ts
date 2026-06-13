import { expect } from "chai";
import { ethers } from "hardhat";

describe("ColdChain trust layer", () => {
  it("role-gates attestation and settles on the true on-chain breach count", async () => {
    const [admin, transporter, supplier, buyer, outsider] = await ethers.getSigners();

    const att = await (await ethers.getContractFactory("ColdChainAttestation")).deploy(admin.address);
    const escrow = await (
      await ethers.getContractFactory("ComplianceEscrow")
    ).deploy(await att.getAddress(), admin.address);

    const shipmentId = ethers.id("SHP-CHN-7"); // bytes32
    const TRANSPORTER_ROLE = await att.TRANSPORTER_ROLE();
    await att.connect(admin).grantRole(TRANSPORTER_ROLE, transporter.address);
    await att.connect(admin).setThreshold(shipmentId, 2500); // 25.00 °C in centi-°C

    // An outsider without the role cannot attest.
    await expect(att.connect(outsider).attest(shipmentId, 1000)).to.be.reverted;

    // 3 compliant + 5 breach readings.
    for (const t of [1000, 2000, 2400]) await att.connect(transporter).attest(shipmentId, t);
    for (const t of [2800, 3000, 3200, 3300, 3400]) await att.connect(transporter).attest(shipmentId, t);
    expect(await att.breachCount(shipmentId)).to.equal(5n);

    // Buyer funds escrow: 1 ETH, tolerate 2 breaches, penalty 0.1 ETH each.
    const payment = ethers.parseEther("1");
    const penalty = ethers.parseEther("0.1");
    await escrow.connect(buyer).fund(shipmentId, supplier.address, 2, penalty, { value: payment });

    const before = await ethers.provider.getBalance(supplier.address);
    await escrow.connect(admin).settleDelivery(shipmentId);
    const after = await ethers.provider.getBalance(supplier.address);

    // over = 5 - 2 = 3 → penalty 0.3 ETH → supplier paid 0.7 ETH.
    expect(after - before).to.equal(ethers.parseEther("0.7"));

    // Cannot double-settle.
    await expect(escrow.settleDelivery(shipmentId)).to.be.revertedWith("already settled");
  });

  it("pays in full when within the breach limit", async () => {
    const [admin, transporter, supplier, buyer] = await ethers.getSigners();
    const att = await (await ethers.getContractFactory("ColdChainAttestation")).deploy(admin.address);
    const escrow = await (
      await ethers.getContractFactory("ComplianceEscrow")
    ).deploy(await att.getAddress(), admin.address);

    const shipmentId = ethers.id("SHP-OK");
    await att.connect(admin).grantRole(await att.TRANSPORTER_ROLE(), transporter.address);
    await att.connect(admin).setThreshold(shipmentId, 2500);
    for (const t of [400, 500, 600, 2400]) await att.connect(transporter).attest(shipmentId, t); // 0 breaches

    const payment = ethers.parseEther("1");
    await escrow.connect(buyer).fund(shipmentId, supplier.address, 2, ethers.parseEther("0.1"), { value: payment });
    const before = await ethers.provider.getBalance(supplier.address);
    await escrow.connect(admin).settleDelivery(shipmentId);
    const after = await ethers.provider.getBalance(supplier.address);
    expect(after - before).to.equal(payment);
  });
});
