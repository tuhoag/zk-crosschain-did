// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {console} from "hardhat/console.sol";

import {StatusState} from "./utils/StatusState.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";
import {Errors} from "./utils/Errors.sol";
import {OracleType} from "./utils/OracleType.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract Verifier {
  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);

  uint8 public id;
  uint64 public subscriptionId;
  IStatusRegistry public registryContract;

  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public blsIssuanceStatus;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public blsRevocationStatus;

  constructor(uint8 _id, address _statusRegistryAddress) {
    id = _id;
    registryContract = IStatusRegistry(_statusRegistryAddress);
  }

  function getSubscriptionId() public view returns (uint64) {
    return subscriptionId;
  }

  function setSubscriptionId(uint64 _subscriptionId) public {
    subscriptionId = _subscriptionId;
  }

  function getId() public view returns (uint8) {
    return id;
  }

  function getBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) public view returns (StatusState.BSLStatus memory) {
    if (statusType == StatusState.StatusType.Issuance) {
      return blsIssuanceStatus[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      return blsRevocationStatus[issuerId];
    } else {
      revert Errors.InvalidStatusType(statusType);
    }
  }

  function requestStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    OracleType oracleType,
    uint32 callbackGasLimit
  ) external {
    console.log(uint8(oracleType));
    registryContract.requestStatus(address(this), issuerId, statusType, refresh, oracleType, subscriptionId, callbackGasLimit);
  }

  function fulfillBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    if (statusType == StatusState.StatusType.Issuance) {
      blsIssuanceStatus[issuerId] = status;
    } else if (statusType == StatusState.StatusType.Revocation) {
      blsRevocationStatus[issuerId] = status;
    }

    emit StatusUpdated(issuerId, statusType);
  }
}
