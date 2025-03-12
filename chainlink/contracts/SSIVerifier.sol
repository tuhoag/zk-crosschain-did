// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {StatusState} from "./utils/StatusState.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";
import {Errors} from "./utils/Errors.sol";
import {OracleType} from "./utils/OracleType.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract SSIVerifier {
  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);

  uint8 public id;
  uint64 public subscriptionId;
  IStatusRegistry public registryContract;

  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.BSLStatus)) public bslStatuses;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.BigBSLStatus)) public bbslStatuses;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.MTStatus[])) public mtStatuses;

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
  ) external view returns (StatusState.BSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    return bslStatuses[issuerId][statusType];
  }

  function setBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    bslStatuses[issuerId][statusType] = status;
    emit StatusUpdated(issuerId, statusType);
  }

  function getBigBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.BigBSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    return bbslStatuses[issuerId][statusType];
  }

  function setBigBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status
  ) external {
    // console.log("SSIVerifier: setBigBSLStatus");
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    bbslStatuses[issuerId][statusType] = status;
    emit StatusUpdated(issuerId, statusType);
  }

  function setMTStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.MTStatus memory status
  ) external {
    // console.log("SSIVerifier: setMTStatus");

    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.MTStatus[] storage statuses = mtStatuses[issuerId][statusType];
    // console.log(statuses.length);
    if(statuses.length > 0 && status.time != 0) {
      if (statuses[statuses.length - 1].time >= status.time) revert Errors.InvalidMTStatusTime(statuses[statuses.length - 1].time, status.time);
    }

    statuses.push(status);
    emit StatusUpdated(issuerId, statusType);
  }

  function getMTStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.MTStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(StatusState.INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.MTStatus[] storage statuses = mtStatuses[issuerId][statusType];
    return statuses[statuses.length - 1];
  }

  function requestStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    OracleType oracleType,
    uint32 callbackGasLimit
  ) external {
    // console.log("SSIVerifier: requestStatus");
    // console.log(uint8(oracleType));
    registryContract.requestStatus(address(this), issuerId, statusType, refresh, oracleType, subscriptionId, callbackGasLimit);
  }
}