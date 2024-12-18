// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import {StatusState} from "./utils/StatusState.sol";
import {IOracleConsumer} from "./utils/IOracleConsumer.sol";
import {IVerifier} from "./utils/IVerifier.sol";
import {Errors} from "./utils/Errors.sol";
import {OracleType} from "./utils/OracleType.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry {
  struct Request {
    address requesterAddress;
    StatusState.IssuerId issuerId;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
    OracleType oracleType;
  }

  StatusState.IssuerId public constant INVALID_ISSUER_ID = StatusState.IssuerId.wrap(0);

  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);

  mapping(bytes32 => Request) public requests;
  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslIssuanceStatuses;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslRevocationStatuses;

  IOracleConsumer public consumerContract;
  IOracleConsumer public zkConsumerContract;

  constructor(address consumerAddress, address zkConsumerAddress) {
    consumerContract = IOracleConsumer(consumerAddress);
    zkConsumerContract = IOracleConsumer(zkConsumerAddress);
  }

  function getIssuer(StatusState.IssuerId issuerId) external view returns (StatusState.Issuer memory) {
    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert Errors.IssuerNotFound(issuerId);
    return issuer;
  }

  function addIssuer(
    StatusState.IssuerId issuerId,
    string calldata url,
    StatusState.StatusMechanism statusMechanism
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);

    issuers[issuerId] = StatusState.Issuer(url, statusMechanism);
  }

  function getConsumerAddress(OracleType oracleType) external view returns (address) {
    if (oracleType == OracleType.ChainlinkConsumer) return address(consumerContract);
    if (oracleType == OracleType.ZKConsumer) return address(zkConsumerContract);

    revert Errors.InvalidOracleType(oracleType);
  }

  function getBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.BSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      return bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      return bslRevocationStatuses[issuerId];
    } else {
      revert Errors.InvalidStatusType(statusType);
    }
  }

  function setBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      bslIssuanceStatuses[issuerId] = status;
    } else if (statusType == StatusState.StatusType.Revocation) {
      bslRevocationStatuses[issuerId] = status;
    } else {
      revert Errors.InvalidStatusType(statusType);
    }
  }

  function requestStatus(
    address requesterAddress,
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    OracleType oracleType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert Errors.IssuerNotFound(issuerId);

    StatusState.BSLStatus memory lastStatusState;
    if (statusType == StatusState.StatusType.Issuance) {
      lastStatusState = bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      lastStatusState = bslRevocationStatuses[issuerId];
    } else {
      revert Errors.InvalidStatusType(statusType);
    }

    bytes32 requestId;
    console.log("StatusRegistry: request consumer. Is it chainlink %s, is it ZK %s", oracleType == OracleType.ChainlinkConsumer, oracleType == OracleType.ZKConsumer);

    if (refresh) {
      if (oracleType == OracleType.ChainlinkConsumer) {
        console.log("StatusRegistry: request chainlink consumer");
        requestId = consumerContract.requestBSLStatus(
          address(this),
          issuer.url,
          lastStatusState,
          statusType,
          subscriptionId,
          callbackGasLimit
        );
      } else if (oracleType == OracleType.ZKConsumer) {
        // console.log("StatusRegistry: request consumer. Is it chainlink %s, is it ZK %s", oracleType == OracleType.ChainlinkConsumer, oracleType == OracleType.ZKConsumer);
        console.log("StatusRegistry: requesting zk consumer %s", uint8(oracleType));
        requestId = zkConsumerContract.requestBSLStatus(
          address(this),
          issuer.url,
          lastStatusState,
          statusType,
          subscriptionId,
          callbackGasLimit
        );
      } else {
        revert Errors.InvalidOracleType(oracleType);
      }

      requests[requestId] = Request(requesterAddress, issuerId, statusType, issuer.statusMechanism, oracleType);
    } else {
      requestId = bytes32(0);
      IVerifier verifier = IVerifier(requesterAddress);
      verifier.fulfillBSLStatus(issuerId, statusType, lastStatusState);
    }

    return requestId;
  }

  function fulfillBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    StatusState.BSLStatus memory lastStatusState;
    if (statusType == StatusState.StatusType.Issuance) {
      lastStatusState = bslIssuanceStatuses[request.issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      lastStatusState = bslRevocationStatuses[request.issuerId];
    } else {
      revert Errors.InvalidStatusType(statusType);
    }

    if (!StatusState.checkBSLStatusValidity(lastStatusState, status)) revert Errors.InvalidBSLStatus(requestId);

    this.setBSLStatus(request.issuerId, statusType, status);
    IVerifier verifier = IVerifier(request.requesterAddress);
    verifier.fulfillBSLStatus(request.issuerId, statusType, status);

    emit StatusUpdated(request.issuerId, statusType);
  }
}
