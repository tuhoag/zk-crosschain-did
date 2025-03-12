// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Errors} from "./utils/Errors.sol";

uint8 constant NUM_STATES = 20;

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
interface IGroth16SingleMTStateVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[4] calldata input) external view;
}

interface IGroth16MTStateVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[(NUM_STATES + 1) * 2] calldata input) external view;
}

interface IGroth16MTStateReportVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[(NUM_STATES + 1) * 2 + 2] calldata input) external view;
}

contract MTStateRegistry {
    struct MTStatus {
        uint8 time;
        uint256 root;
    }

    mapping(uint8 => MTStatus[]) public states; // issuer id -> state[]
    mapping(uint8 => uint256) public balances; // oracle id -> balance
    uint8 public f;

    IGroth16SingleMTStateVerifier public singleStateVerifier;
    IGroth16MTStateVerifier public multiStateVerifier;
    IGroth16MTStateReportVerifier public stateReportVerifier;

    function setSingleMTVerifier(address verifierAddress) public {
        singleStateVerifier = IGroth16SingleMTStateVerifier(verifierAddress);
    }

    function setMultipleMTVerifier(address verifierAddress) public {
        multiStateVerifier = IGroth16MTStateVerifier(verifierAddress);
    }

    function setMTReportVerifier(address verifierAddress) public {
        stateReportVerifier = IGroth16MTStateReportVerifier(verifierAddress);
    }

    function setFaultTolerance(uint8 _f) public {
        f = _f;
    }

    function registerOracle(uint8 oracleId, uint256 deposit) public {
        balances[oracleId] = deposit;
    }

    function getPreviousState(uint8 issuerId) public view returns (MTStatus memory) {
        return states[issuerId][states[issuerId].length - 1];
    }

    function setState(uint8 issuerId, MTStatus memory state) public {
        states[issuerId].push(state);
    }

    function initializeState(uint8 issuerId) public {
        MTStatus[] storage issuerStates = states[issuerId];
        if (issuerStates.length > 0) {
            return;
        }

        issuerStates.push(MTStatus(0, 0));
    }

    function submitSingleState(
        uint8 issuerId,
        uint8 time,
        uint256 root,
        uint256[8] calldata proof
    ) public {
        MTStatus memory previousState = getPreviousState(issuerId);

        uint256[4] memory publicInputs;
        publicInputs[0] = uint256(previousState.time);
        publicInputs[1] = uint256(time);
        publicInputs[2] = previousState.root;
        publicInputs[3] = root;

        try singleStateVerifier.verifyProof(proof, publicInputs) {
            setState(issuerId, MTStatus(time, root));
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, time);
        }
    }

    function submitMultipleStatesWithProof(
        uint8 issuerId,
        uint8[] calldata times,
        uint256[] calldata roots,
        uint256[8] calldata proof
    ) public {
        MTStatus memory previousState = getPreviousState(issuerId);
        uint256[(NUM_STATES + 1) * 2] memory publicInputs;

        publicInputs[0] = uint256(previousState.time);
        publicInputs[NUM_STATES + 1]  = previousState.root;

        for (uint8 i = 0; i < NUM_STATES; i++) {
            publicInputs[i + 1] = uint256(times[i]);
            publicInputs[i + NUM_STATES + 2] = roots[i];
        }

        // for (uint8 i = 0; i < (NUM_STATES + 1) * 2; i++) {
        //     console.log(publicInputs[i]);
        // }

        // for (uint8 i = 0; i < 8; i++) {
        //     console.log(proof[i]);
        // }
        try multiStateVerifier.verifyProof(proof, publicInputs) {
            // console.log("Proof verified");
            for (uint8 i = 0; i < NUM_STATES; i++) {
                setState(issuerId, MTStatus(times[i], roots[i]));
            }
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, times[0]);
        }
    }

    function updateBalances(uint256 indicator, uint8[] calldata oracleIds) public {
        for (uint8 i = 0; i < oracleIds.length; i++) {
            if ((indicator & (1 << i)) == 0) {
                balances[oracleIds[i]] += 1;
            } else {
                balances[oracleIds[i]] -= 1;
            }
        }
    }

    function submitMultipleStateReport(
        uint8 issuerId,
        uint8[] calldata times,
        uint256[] calldata roots,
        uint8[] calldata oracleIds,
        uint256 indicator,
        uint256[8] calldata proof
    ) public {
        MTStatus memory previousState = getPreviousState(issuerId);
        uint256[(NUM_STATES + 1) * 2 + 2] memory publicInputs;
        publicInputs[0] = uint256(previousState.time);
        publicInputs[NUM_STATES + 1]  = previousState.root;

        for (uint8 i = 0; i < NUM_STATES; i++) {
            publicInputs[i + 1] = uint256(times[i]);
            publicInputs[i + NUM_STATES + 2] = roots[i];
        }

        publicInputs[(NUM_STATES + 1) * 2] = uint256(indicator);
        publicInputs[(NUM_STATES + 1) * 2 + 1] = uint256(f);

        // for (uint8 i = 0; i < 16; i++) {
        //     console.log(publicInputs[i]);
        //     // console.log("Public input: %d", publicInputs[i]);
        // }
        // update balance
        updateBalances(indicator, oracleIds);

        try stateReportVerifier.verifyProof(proof, publicInputs) {
            // console.log("Proof verified");
            for (uint8 i = 0; i < NUM_STATES; i++) {
                setState(issuerId, MTStatus(times[i], roots[i]));
            }
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, times[0]);
        }
    }

    function verifyMultipleStatesProof(uint256[8] calldata proof, uint256[(NUM_STATES + 1) * 2] calldata publicInputs) public view {
        multiStateVerifier.verifyProof(proof, publicInputs);
    }

    function verifySingleStateProof(uint256[8] calldata proof, uint256[4] calldata publicInputs) public view {
        singleStateVerifier.verifyProof(proof, publicInputs);
    }
}