// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {StatusState} from "./utils/StatusState.sol";
/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry is FunctionsClient, ConfirmedOwner {
  using FunctionsRequest for FunctionsRequest.Request;
  // using StatusState for IssuerId;
  struct Request {
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
  error EmptySource();
  error UnsupportedStatusMechanism(StatusState.StatusMechanism);

  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);
  event ResponseReceived(bytes32 requestId, bytes response, bytes error);

  bytes32 public donId; // DON ID for the Functions DON to which the requests are sent
  bytes32 public lastRequestId;
  bytes public lastResponse;
  bytes public lastError;
  string public source;

  mapping(bytes32 => Request) public requests;
  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslIssuanceStatuses;
  mapping(StatusState.IssuerId => StatusState.BSLStatus) public bslRevocationStatuses;

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

  function getIssuer(StatusState.IssuerId issuerId) external view returns (StatusState.Issuer memory) {
    StatusState.Issuer memory issuer = issuers[issuerId];
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

  function addIssuer(StatusState.IssuerId issuerId, string calldata url, StatusState.StatusMechanism statusMechanism) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);
    issuers[issuerId] = StatusState.Issuer(url, statusMechanism);
  }

  function getBSLStatus(StatusState.IssuerId issuerId, StatusState.StatusType statusType) external view returns (StatusState.BSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      return bslIssuanceStatuses[issuerId];
    } else if (statusType == StatusState.StatusType.Revocation) {
      return bslRevocationStatuses[issuerId];
    } else {
      revert InvalidStatusType(statusType);
    }
  }

  function setBSLStatus(StatusState.IssuerId issuerId, StatusState.StatusType statusType, StatusState.BSLStatus memory status) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);

    if (statusType == StatusState.StatusType.Issuance) {
      bslIssuanceStatuses[issuerId] = status;
    } else if (statusType == StatusState.StatusType.Revocation) {
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
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external {
    if (bytes(source).length == 0) revert EmptySource();
    if (statusType == StatusState.StatusType.Invalid) revert InvalidStatusType(statusType);

    // get issuer URL
    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert IssuerNotFound(issuerId);

    string[] memory args = new string[](5);
    args[0] = issuer.url;

    if (issuer.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(issuerId, statusType);
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
      if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID)) revert RequestNotFound(requestId);

      StatusState.Issuer memory issuer = issuers[request.issuerId];
      if (bytes(issuer.url).length == 0) revert IssuerNotFound(request.issuerId);

      if (issuer.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
        (uint64 time, uint64 status) = abi.decode(
          response,
          (uint64, uint64)
        );

        StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(request.issuerId, request.statusType);
        StatusState.BSLStatus memory newStatusState = StatusState.BSLStatus(time, status);

        // check validity of status
        if (!StatusState.checkBSLStatusValidity(lastStatusState, newStatusState)) revert InvalidBSLStatus(requestId);

        this.setBSLStatus(request.issuerId, request.statusType, newStatusState);
        // emit StatusUpdated(request.issuerId, request.statusType);
      } else {
        revert UnsupportedStatusMechanism(issuer.statusMechanism);
      }
    }
  }
}
