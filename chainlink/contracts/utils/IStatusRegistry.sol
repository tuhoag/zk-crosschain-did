// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";
import {OracleType} from "./OracleType.sol";

interface IStatusRegistry {
  function requestStatus(
    address requesterAddress,
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    OracleType oracleType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32);

  function fulfillBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external;

  function fulfillBSLStatusWithProof(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status,
    uint256[8] memory proof
  ) external;

  function fulfillBigBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status
  ) external;

  function fulfillBigBSLStatusWithProof(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status,
    uint256[8] memory proof
  ) external;

  function fulfillMTStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.MTStatus memory status
  ) external;

  function fulfillMTStatusWithProof(
    bytes32 requestId,
    StatusState.StatusType statusType,
    uint32[10] memory times,
    uint256[10] memory roots,
    uint256[8] memory proof
  ) external;
}
