// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";

library Errors {
  error InvalidStatusType(StatusState.StatusType statusType);
  error EmptySource();
  error UnsupportedStatusMechanism(StatusState.StatusMechanism);
  error InvalidUrl(string url);
  error InvalidRequesterAddress(address requesterAddress);
  error IssuerNotFound(StatusState.IssuerId issuerId);
  error RequestNotFound(bytes32 requestId);
  error InvalidBSLStatus(bytes32 requestId);
  error InvalidIssuerId(StatusState.IssuerId issuerId);
}
