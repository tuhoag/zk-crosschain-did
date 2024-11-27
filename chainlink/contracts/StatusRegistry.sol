// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

enum StatusType {
  Invalid,
  Issuance,
  Revocation
}

enum StatusMechanism {
  BitStatusList,
  MerkleTree
}

struct StatusState {
  uint64 time;
  string status;
  // StatusMechanism statusMechanism;
  // StatusType statusType;
}

type IssuerId is uint8;

struct Issuer {
  string url;
  StatusMechanism statusMechanism;
}

struct Request {
  IssuerId issuerId;
  StatusType statusType;
  StatusMechanism statusMechanism;
}

struct BSLStatus {
  uint64 time;
  uint64 status;
}

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry is FunctionsClient, ConfirmedOwner {
  using FunctionsRequest for FunctionsRequest.Request;

  IssuerId public constant INVALID_ISSUER_ID = IssuerId.wrap(0);

  error IssuerNotFound(IssuerId issuerId);
  error RequestNotFound(bytes32 requestId);
  error InvalidBSLStatus(bytes32 requestId);
  error InvalidIssuerId(IssuerId issuerId);
  error InvalidStatusType(StatusType statusType);
  error EmptySource();
  error UnsupportedStatusMechanism(StatusMechanism);

  event StatusUpdated(IssuerId issuerId, StatusType statusType);
  event ResponseReceived(bytes32 requestId, bytes response, bytes error);

  bytes32 public donId; // DON ID for the Functions DON to which the requests are sent
  bytes32 public lastRequestId;
  bytes public lastResponse;
  bytes public lastError;
  string public source;

  mapping(bytes32 => Request) public requests;
  mapping(IssuerId => Issuer) public issuers;
  mapping(IssuerId => BSLStatus) public bslIssuanceStatuses;
  mapping(IssuerId => BSLStatus) public bslRevocationStatuses;

  constructor(address router, bytes32 _donId) FunctionsClient(router) ConfirmedOwner(msg.sender) {
    donId = _donId;
  }

  /**
   * @notice Set the DON ID
   * @param newDonId New DON ID
   */
  function setDonId(bytes32 newDonId) external onlyOwner {
    donId = newDonId;
  }

  function getIssuer(IssuerId issuerId) external view returns (Issuer memory) {
    Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert IssuerNotFound(issuerId);
    return issuer;
  }

  function getSource() external view returns (string memory) {
    return source;
  }

  function setSource(string calldata _source) external {
    if (bytes(_source).length == 0) revert EmptySource();
    source = _source;
  }

  function addIssuer(IssuerId issuerId, string calldata url, StatusMechanism statusMechanism) external {
    if (IssuerId.unwrap(issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);
    issuers[issuerId] = Issuer(url, statusMechanism);
  }

  function getBSLStatus(IssuerId issuerId, StatusType statusType) external view returns (BSLStatus memory) {
    if (IssuerId.unwrap(issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);

    if (statusType == StatusType.Issuance) {
      return bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusType.Revocation) {
      return bslRevocationStatuses[issuerId];
    } else {
      revert InvalidStatusType(statusType);
    }
  }

  function setBSLStatus(IssuerId issuerId, StatusType statusType, BSLStatus memory status) external {
    if (IssuerId.unwrap(issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);

    if (statusType == StatusType.Issuance) {
      bslIssuanceStatuses[issuerId] = status;
    } else if (statusType == StatusType.Revocation) {
      bslRevocationStatuses[issuerId] = status;
    } else {
      revert InvalidStatusType(statusType);
    }
  }

  /**
   * @notice Triggers an on-demand Functions request using remote encrypted secrets
   * @param subscriptionId Subscription ID used to pay for request (FunctionsConsumer contract address must first be added to the subscription)
   * @param callbackGasLimit Maximum amount of gas used to call the inherited `handleOracleFulfillment` method
   */
  function requestStatus(
    IssuerId issuerId,
    // string calldata source,
    // FunctionsRequest.Location secretsLocation,
    // bytes calldata encryptedSecretsReference,
    // string[] calldata args,
    StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external {
    if (bytes(source).length == 0) revert EmptySource();
    if (statusType == StatusType.Invalid) revert InvalidStatusType(statusType);

    // get issuer URL
    Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert IssuerNotFound(issuerId);

    string[] memory args = new string[](5);
    args[0] = issuer.url;

    if (issuer.statusMechanism == StatusMechanism.BitStatusList) {
      BSLStatus memory lastStatusState = this.getBSLStatus(issuerId, statusType);
      args[1] = Strings.toString(lastStatusState.status);
      args[2] = Strings.toString(lastStatusState.time);
    } else {
      revert UnsupportedStatusMechanism(issuer.statusMechanism);
    }

    args[3] = Strings.toString(uint8(statusType));
    args[4] = Strings.toString(uint8(issuer.statusMechanism));

    bytes[] memory emptyBytesArray;
    bytes32 requestId = this.sendRequest(source, FunctionsRequest.Location.Remote, bytes(""), args, emptyBytesArray, subscriptionId, callbackGasLimit);
    requests[requestId] = Request(issuerId, statusType, issuer.statusMechanism);
  }

  /**
   * @notice Triggers an on-demand Functions request using remote encrypted secrets
   * @param _source JavaScript source code
   * @param secretsLocation Location of secrets (only Location.Remote & Location.DONHosted are supported)
   * @param encryptedSecretsReference Reference pointing to encrypted secrets
   * @param args String arguments passed into the source code and accessible via the global variable `args`
   * @param bytesArgs Bytes arguments passed into the source code and accessible via the global variable `bytesArgs` as hex strings
   * @param subscriptionId Subscription ID used to pay for request (FunctionsConsumer contract address must first be added to the subscription)
   * @param callbackGasLimit Maximum amount of gas used to call the inherited `handleOracleFulfillment` method
   */
  function sendRequest(
    string calldata _source,
    FunctionsRequest.Location secretsLocation,
    bytes calldata encryptedSecretsReference,
    string[] memory args,
    bytes[] memory bytesArgs,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    FunctionsRequest.Request memory req;
    req.initializeRequest(FunctionsRequest.Location.Inline, FunctionsRequest.CodeLanguage.JavaScript, _source);
    req.secretsLocation = secretsLocation;
    req.encryptedSecretsReference = encryptedSecretsReference;
    if (args.length > 0) {
      req.setArgs(args);
    }
    if (bytesArgs.length > 0) {
      req.setBytesArgs(bytesArgs);
    }
    lastRequestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);
    return lastRequestId;
  }

    /**
   * @notice Store latest result/error
   * @param requestId The request ID, returned by sendRequest()
   * @param response Aggregated response from the user code
   * @param err Aggregated error from the user code or from the execution pipeline
   * Either response or error parameter will be set, but never both
   */
  function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
    lastResponse = response;
    lastError = err;

    emit ResponseReceived(requestId, response, err);

    if (response.length > 0) {
      Request memory request = requests[requestId];
      if (IssuerId.unwrap(request.issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert RequestNotFound(requestId);

      Issuer memory issuer = issuers[request.issuerId];
      if (bytes(issuer.url).length == 0) revert IssuerNotFound(request.issuerId);

      if (issuer.statusMechanism == StatusMechanism.BitStatusList) {
        (uint64 time, uint64 status) = abi.decode(
          response,
          (uint64, uint64)
        );

        BSLStatus memory lastStatusState = this.getBSLStatus(request.issuerId, request.statusType);
        BSLStatus memory newStatusState = BSLStatus(time, status);

        // check validity of status
        if (!checkBSLStatusValidity(lastStatusState, newStatusState)) revert InvalidBSLStatus(requestId);

        this.setBSLStatus(request.issuerId, request.statusType, newStatusState);
        // emit StatusUpdated(request.issuerId, request.statusType);
      } else {
        revert UnsupportedStatusMechanism(issuer.statusMechanism);
      }
    }
  }

  function checkBSLStatusValidity(
    BSLStatus memory lastStatusState,
    BSLStatus memory newStatusState
  ) public pure returns (bool) {
    return (lastStatusState.status & newStatusState.status) == lastStatusState.status;
  }
}
