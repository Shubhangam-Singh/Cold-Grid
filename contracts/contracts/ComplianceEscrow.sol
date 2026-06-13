// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ColdChainAttestation} from "./ColdChainAttestation.sol";

/**
 * ComplianceEscrow — the real-contract twin of lib/chain/escrow.ts.
 *
 * A buyer funds an escrow for a shipment. On delivery, anyone may settle: the
 * contract reads the on-chain breach count from ColdChainAttestation and pays
 * the supplier the agreed amount minus a penalty for breaches over the limit;
 * the penalty is refunded to the buyer. Trustless and automatic — falsifying
 * the temperature log is impossible because it lives on the attestation ledger.
 *
 * No mainnet, no real money — for a local Hardhat node / free testnet only.
 */
contract ComplianceEscrow is AccessControl {
    ColdChainAttestation public immutable attestations;

    struct Deal {
        address supplier;
        address buyer;
        uint256 payment;
        uint256 maxBreaches;
        uint256 penaltyPerBreach;
        bool settled;
    }

    mapping(bytes32 => Deal) public deals;

    event DealFunded(bytes32 indexed shipmentId, address indexed supplier, address indexed buyer, uint256 payment);
    event Settled(bytes32 indexed shipmentId, uint256 breaches, uint256 paidToSupplier, uint256 refundedToBuyer);

    constructor(ColdChainAttestation _attestations, address admin) {
        attestations = _attestations;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// Buyer locks payment for a shipment with agreed compliance terms.
    function fund(
        bytes32 shipmentId,
        address supplier,
        uint256 maxBreaches,
        uint256 penaltyPerBreach
    ) external payable {
        require(deals[shipmentId].payment == 0, "already funded");
        require(msg.value > 0, "no payment");
        require(supplier != address(0), "bad supplier");
        deals[shipmentId] = Deal({
            supplier: supplier,
            buyer: msg.sender,
            payment: msg.value,
            maxBreaches: maxBreaches,
            penaltyPerBreach: penaltyPerBreach,
            settled: false
        });
        emit DealFunded(shipmentId, supplier, msg.sender, msg.value);
    }

    /// Settle on delivery using the tamper-proof on-chain breach count.
    function settleDelivery(bytes32 shipmentId) external {
        Deal storage d = deals[shipmentId];
        require(d.payment > 0, "no deal");
        require(!d.settled, "already settled");
        d.settled = true;

        uint256 breaches = attestations.breachCount(shipmentId);
        uint256 over = breaches > d.maxBreaches ? breaches - d.maxBreaches : 0;
        uint256 penalty = over * d.penaltyPerBreach;
        if (penalty > d.payment) {
            penalty = d.payment;
        }
        uint256 toSupplier = d.payment - penalty;

        if (toSupplier > 0) {
            payable(d.supplier).transfer(toSupplier);
        }
        if (penalty > 0) {
            payable(d.buyer).transfer(penalty);
        }
        emit Settled(shipmentId, breaches, toSupplier, penalty);
    }
}
