// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {Errors} from "./utils/Errors.sol";

uint8 constant NUM_STATES = 10;
uint16 constant DATA_SIZE = 7;
// uint8 constant NUM_ORACLES = 4;

/*
 * @title Chainlink Functions example on-demand consumer contract example
 */

uint256 constant STATE_INPUT_SIZE = 2 + 2 * DATA_SIZE;
uint256 constant REPORT_INPUT_SIZE = 4 + 2 * DATA_SIZE;
uint256 constant CHANGES_REPORT_INPUT_SIZE = 3 + DATA_SIZE + NUM_STATES * 3;

interface IGroth16BSLStateVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[STATE_INPUT_SIZE] calldata input) external view;
}

interface IGroth16BSLStateReportVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[REPORT_INPUT_SIZE] calldata input) external view;
}

interface IGroth16BSLStateChangesReportVerifier {
    function verifyProof(uint256[8] calldata proof, uint256[CHANGES_REPORT_INPUT_SIZE] calldata input) external view;
}


contract BSLStateRegistry {
    struct BSLStatus {
        uint8 time;
        uint256[DATA_SIZE] data;
    }

    mapping(uint8 => BSLStatus) public states; // issuer id -> state[]
    mapping(uint8 => uint256) public balances; // oracle id -> balance
    uint8 public f;

    IGroth16BSLStateVerifier public stateVerifier;
    IGroth16BSLStateReportVerifier public stateReportVerifier;
    IGroth16BSLStateChangesReportVerifier public stateChangesReportVerifier;

    function setBSLVerifier(address verifierAddress) public {
        stateVerifier = IGroth16BSLStateVerifier(verifierAddress);
    }

    function setBSLReportVerifier(address verifierAddress) public {
        stateReportVerifier = IGroth16BSLStateReportVerifier(verifierAddress);
    }

    function setBSLStateChangesReportVerifier(address verifierAddress) public {
        stateChangesReportVerifier = IGroth16BSLStateChangesReportVerifier(verifierAddress);
    }

    function setFaultTolerance(uint8 _f) public {
        f = _f;
    }

    function getPreviousState(uint8 issuerId) public view returns (BSLStatus memory) {
        return states[issuerId];
    }

    function setState(uint8 issuerId, BSLStatus memory state) public {
        states[issuerId] = state;
    }

    function setStateByChanges(uint8 issuerId, uint8[] calldata times, uint16[] calldata index, uint256[] calldata changes) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        previousState.time = times[times.length - 1];

        for (uint16 i = 0; i < index.length; i++) {
            previousState.data[index[i]] = previousState.data[index[i]] | changes[i];
        }

        setState(issuerId, previousState);
    }

    function initializeState(uint8 issuerId) public {
        uint256[DATA_SIZE] memory data;
        for (uint8 i = 0; i < DATA_SIZE; i++) {
            data[i] = uint256(0);
        }
        states[issuerId] = BSLStatus(0, data);
    }

    function registerOracle(uint8 oracleId, uint256 deposit) public {
        balances[oracleId] = deposit;
    }

    function countBits(uint256 x) public pure returns (uint256) {
        uint256 count = 0;
        while (x > 0) {
            count += x & 1; // Add the least significant bit
            x >>= 1;        // Shift right to process the next bit
        }
        return count;
    }

    function checkBSLPartValidity(uint256 oldData, uint256 newData) internal pure returns (bool) {
        uint256 curDiff = oldData ^ newData;
        if (countBits(curDiff) == 1) {
            return true;
        }

        return false;
    }

    function checkBSLStatusValidity(
    BSLStatus memory lastStatusState,
    BSLStatus memory newStatusState
    ) internal pure returns (bool) {
        uint256 numDiff = 0;
        for (uint256 i = 0; i < DATA_SIZE; i++) {

            if ((lastStatusState.data[i] & newStatusState.data[i]) != lastStatusState.data[i]) {
                return false;
            }

            // check if the difference between the two states is greater than 1 bit
            uint256 curDiff = lastStatusState.data[i] ^ newStatusState.data[i];
            numDiff += countBits(curDiff);

            if (numDiff > 1) {
                return false;
            }
        }
        return true;
    }

    function submitSingleState(
        uint8 issuerId,
        uint8 time,
        uint256[DATA_SIZE] calldata data
    ) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        BSLStatus memory newState = BSLStatus(time, data);
        if (checkBSLStatusValidity(previousState, newState)) {
            setState(issuerId, newState);
        } else {
            revert Errors.InvalidStatusVerification(issuerId, time);
        }
    }

    function submitSinglePartState(
        uint8 issuerId,
        uint8 time,
        uint16 index,
        uint256 data
    ) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        uint256 newData = previousState.data[index] | data;
        if (checkBSLPartValidity(previousState.data[index], newData)) {
            previousState.data[index] = newData;
            previousState.time = time;
            setState(issuerId, previousState);
        } else {
            revert Errors.InvalidStatusVerification(issuerId, time);
        }
    }

    function submitMultipleStatesWithProof(
        uint8 issuerId,
        uint8 time,
        uint256[DATA_SIZE] calldata data,
        uint256[8] calldata proof
    ) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        uint256[2 + 2 * DATA_SIZE] memory publicInputs;
        publicInputs[0] = uint256(previousState.time);
        publicInputs[1] = uint256(time);
        for (uint8 i = 0; i < DATA_SIZE; i++) {
            publicInputs[i + 2] = previousState.data[i];
            publicInputs[i + DATA_SIZE + 2] = data[i];
        }

        // for (uint8 i = 0; i < 16; i++) {
        //     console.log(publicInputs[i]);
        //     // console.log("Public input: %d", publicInputs[i]);
        // }

        try stateVerifier.verifyProof(proof, publicInputs) {
            // console.log("Proof verified");
            setState(issuerId, BSLStatus(time, data));
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, time);
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
        uint16[] calldata indexes,
        uint256[] calldata changes,
        uint8[] calldata oracleIds,
        uint256 indicator,
        uint256[8] calldata proof
    ) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        uint256[REPORT_INPUT_SIZE] memory publicInputs;
        publicInputs[0] = uint256(previousState.time);

        for (uint8 i = 0; i < DATA_SIZE; i++) {
            publicInputs[i + 1] = previousState.data[i];
        }

        for (uint8 i = 0; i < times.length; i++) {
            publicInputs[i + 1 + DATA_SIZE] = uint256(times[i]);
        }

        for (uint8 i = 0; i < indexes.length; i++) {
            publicInputs[i + 1 + DATA_SIZE + times.length] = uint256(indexes[i]);
        }

        for (uint8 i = 0; i < changes.length; i++) {
            publicInputs[i + 1 + DATA_SIZE + times.length + indexes.length] = changes[i];
        }

        publicInputs[REPORT_INPUT_SIZE - 2] = uint256(indicator);
        publicInputs[REPORT_INPUT_SIZE - 1] = uint256(f);

        // for (uint8 i = 0; i < 16; i++) {
        //     console.log(publicInputs[i]);
        //     // console.log("Public input: %d", publicInputs[i]);
        // }
        // update balance
        updateBalances(indicator, oracleIds);

        try stateReportVerifier.verifyProof(proof, publicInputs) {
            // console.log("Proof verified");
            setStateByChanges(issuerId, times, indexes, changes);
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, previousState.time);
        }
    }

    function submitMultipleStateChangesReport(
        uint8 issuerId,
        uint8[] calldata times,
        uint16[] calldata indexes,
        uint256[] calldata changes,
        uint8[] calldata oracleIds,
        uint256 indicator,
        uint256[8] calldata proof
    ) public {
        BSLStatus memory previousState = getPreviousState(issuerId);
        uint256[CHANGES_REPORT_INPUT_SIZE] memory publicInputs;
        publicInputs[0] = uint256(previousState.time);

        for (uint8 i = 0; i < DATA_SIZE; i++) {
            publicInputs[i + 1] = previousState.data[i];
        }

        for (uint8 i = 0; i < times.length; i++) {
            publicInputs[i + 1 + DATA_SIZE] = uint256(times[i]);
        }

        for (uint8 i = 0; i < indexes.length; i++) {
            publicInputs[i + 1 + DATA_SIZE + times.length] = uint256(indexes[i]);
        }

        for (uint8 i = 0; i < changes.length; i++) {
            publicInputs[i + 1 + DATA_SIZE + times.length + indexes.length] = changes[i];
        }

        publicInputs[CHANGES_REPORT_INPUT_SIZE - 2] = uint256(indicator);
        publicInputs[CHANGES_REPORT_INPUT_SIZE - 1] = uint256(f);

        // for (uint8 i = 0; i < 16; i++) {
        //     console.log(publicInputs[i]);
        //     // console.log("Public input: %d", publicInputs[i]);
        // }
        // update balance
        updateBalances(indicator, oracleIds);

        try stateChangesReportVerifier.verifyProof(proof, publicInputs) {
            // console.log("Proof verified");
            setStateByChanges(issuerId, times, indexes, changes);
        } catch {
            revert Errors.InvalidStatusVerification(issuerId, previousState.time);
        }
    }

    function verifyStateProof(uint256[8] calldata proof, uint256[2 + 2 * DATA_SIZE] calldata publicInputs) public view {
        stateVerifier.verifyProof(proof, publicInputs);
    }

    function verifyStateReportProof(uint256[8] calldata proof, uint256[4 + 2 * DATA_SIZE] calldata publicInputs) public view {
        stateReportVerifier.verifyProof(proof, publicInputs);
    }
}