// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";
import {OracleType} from "./OracleType.sol";


library Errors {
  error InvalidStatusType(StatusState.StatusType statusType);
  error InvalidSource();
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
  error WrongOracleExecution(bytes err);
  error UnsupportedResponseType(uint8 responseType);
  error InvalidMTStatusTime(uint32 lastTime, uint32 time);
  error InvalidStatusVerification(uint8 issuerId, uint8 time);
}
