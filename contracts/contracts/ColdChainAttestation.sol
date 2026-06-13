// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * ColdChainAttestation — the real-contract twin of lib/chain/attestation.ts.
 *
 * Temperature readings for a shipment are attested on-chain by an authorized
 * TRANSPORTER (role-gated via OpenZeppelin AccessControl). Each reading over
 * the shipment's threshold increments an immutable, publicly-verifiable breach
 * count. In production the readings come from a decentralized oracle network
 * (e.g. Chainlink) signing real sensor data; here ColdGrid's simulation is the
 * oracle. Temperatures are integer centi-°C (×100) to avoid floats.
 */
contract ColdChainAttestation is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant TRANSPORTER_ROLE = keccak256("TRANSPORTER_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    struct Reading {
        int256 tempCentiC;
        uint256 timestamp;
        address postedBy;
    }

    mapping(bytes32 => Reading[]) private _readings;
    mapping(bytes32 => uint256) public breachCount;
    mapping(bytes32 => int256) public thresholdCentiC;

    event ThresholdSet(bytes32 indexed shipmentId, int256 thresholdCentiC);
    event TemperatureAttested(bytes32 indexed shipmentId, int256 tempCentiC, bool breach, address indexed by);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
    }

    /// Admin sets the cold-chain breach threshold for a shipment.
    function setThreshold(bytes32 shipmentId, int256 _thresholdCentiC)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        thresholdCentiC[shipmentId] = _thresholdCentiC;
        emit ThresholdSet(shipmentId, _thresholdCentiC);
    }

    /// Only a TRANSPORTER may attest a reading. Over-threshold readings count as breaches.
    function attest(bytes32 shipmentId, int256 tempCentiC)
        external
        onlyRole(TRANSPORTER_ROLE)
    {
        _readings[shipmentId].push(Reading(tempCentiC, block.timestamp, msg.sender));
        bool breach = tempCentiC > thresholdCentiC[shipmentId];
        if (breach) {
            breachCount[shipmentId] += 1;
        }
        emit TemperatureAttested(shipmentId, tempCentiC, breach, msg.sender);
    }

    function readingCount(bytes32 shipmentId) external view returns (uint256) {
        return _readings[shipmentId].length;
    }

    /// Convenience for off-chain clients keyed by a human-readable shipment id.
    function breachCountByName(string calldata name) external view returns (uint256) {
        return breachCount[keccak256(bytes(name))];
    }
}
