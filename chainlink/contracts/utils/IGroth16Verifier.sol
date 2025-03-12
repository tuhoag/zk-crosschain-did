// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";

interface IGroth16Verifier {
  function verifyProof(uint256[8] calldata proof, uint256[4] calldata input) external view;
}

interface IGroth16BigVerifier {
  function verifyProof(uint256[8] calldata proof, uint256[16] calldata input) external view;
}

interface IGroth16SingleStateVerifier {
  function verifyProof(uint256[8] calldata proof, uint256[4] calldata input) external view;
}

interface IGroth165MTStateTransitionVerifier {
  function verifyProof(uint256[8] calldata proof, uint256[12] calldata input) external view;
}

interface IGroth1610MTStateTransitionVerifier {
  function verifyProof(uint256[8] calldata proof, uint256[22] calldata input) external view;
}