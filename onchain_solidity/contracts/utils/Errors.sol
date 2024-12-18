// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";
import {OracleType} from "./OracleType.sol";


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
  error InvalidDeposit(uint64 token);
  error OracleNotFound(uint256 oracleId);
  error OracleAlreadyExists(uint256 oracleId);
  error InvalidOracleType(OracleType oracleType);
}
