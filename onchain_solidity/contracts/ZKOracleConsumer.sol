// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./utils/StatusState.sol";

contract ZKOracleConsumer {
  function requestBSLStatus(
    address requesterAddress,
    string memory url,
    StatusState.BSLStatus memory lastStatusState,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {}
}
