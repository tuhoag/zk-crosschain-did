// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";

interface IStatusRegistry {
  function requestStatus(
    address requesterAddress,
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32);

  function fulfillBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external;
}
