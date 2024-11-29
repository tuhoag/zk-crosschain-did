// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./utils/StatusState.sol";
import {IOracleConsumer} from "./utils/IOracleConsumer.sol";
import {IVerifier} from "./utils/IVerifier.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry {
  struct Request {
    address requesterAddress;
    StatusState.IssuerId issuerId;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
  }

  StatusState.IssuerId public constant INVALID_ISSUER_ID = StatusState.IssuerId.wrap(0);

  error IssuerNotFound(StatusState.IssuerId issuerId);
  error RequestNotFound(bytes32 requestId);
  error InvalidBSLStatus(bytes32 requestId);
  error InvalidIssuerId(StatusState.IssuerId issuerId);
  error InvalidStatusType(StatusState.StatusType statusType);
  error UnsupportedStatusMechanism(StatusState.StatusMechanism);
  error InvalidUrl(string url);

  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);

  mapping(bytes32 => Request) public requests;
  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslIssuanceStatuses;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslRevocationStatuses;

  IOracleConsumer public consumerContract;

  constructor(address consumerAddress) {
    consumerContract = IOracleConsumer(consumerAddress);
  }

  function getIssuer(StatusState.IssuerId issuerId) external view returns (StatusState.Issuer memory) {
    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert IssuerNotFound(issuerId);
    return issuer;
  }

  function addIssuer(
    StatusState.IssuerId issuerId,
    string calldata url,
    StatusState.StatusMechanism statusMechanism
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert InvalidIssuerId(issuerId);

    if (bytes(url).length == 0) revert InvalidUrl(url);

    issuers[issuerId] = StatusState.Issuer(url, statusMechanism);
  }

  function getBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.BSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      return bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      return bslRevocationStatuses[issuerId];
    } else {
      revert InvalidStatusType(statusType);
    }
  }

  function setBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      bslIssuanceStatuses[issuerId] = status;
    } else if (statusType == StatusState.StatusType.Revocation) {
      bslRevocationStatuses[issuerId] = status;
    } else {
      revert InvalidStatusType(statusType);
    }
  }

  function requestStatus(
    address requesterAddress,
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert InvalidIssuerId(issuerId);

    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert IssuerNotFound(issuerId);

    StatusState.BSLStatus memory lastStatusState;
    if (statusType == StatusState.StatusType.Issuance) {
      lastStatusState = bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      lastStatusState = bslRevocationStatuses[issuerId];
    } else {
      revert InvalidStatusType(statusType);
    }

    bytes32 requestId;
    if (refresh) {
      requestId = consumerContract.requestBSLStatus(
        address(this),
        issuer.url,
        lastStatusState,
        statusType,
        subscriptionId,
        callbackGasLimit
      );
      requests[requestId] = Request(requesterAddress, issuerId, statusType, issuer.statusMechanism);
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
      revert RequestNotFound(requestId);

    StatusState.BSLStatus memory lastStatusState;
    if (statusType == StatusState.StatusType.Issuance) {
      lastStatusState = bslIssuanceStatuses[request.issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      lastStatusState = bslRevocationStatuses[request.issuerId];
    } else {
      revert InvalidStatusType(statusType);
    }

    if (!StatusState.checkBSLStatusValidity(lastStatusState, status)) revert InvalidBSLStatus(requestId);

    this.setBSLStatus(request.issuerId, statusType, status);
    IVerifier verifier = IVerifier(request.requesterAddress);
    verifier.fulfillBSLStatus(request.issuerId, statusType, status);

    emit StatusUpdated(request.issuerId, statusType);
  }
}
