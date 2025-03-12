// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";

interface IOracleConsumer {
  function requestStatus(
    address requesterAddress,
    string memory url,
    StatusState.StatusType statusType,
    StatusState.StatusMechanism statusMechanism,
    bytes memory lastStatusState,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32);
}
