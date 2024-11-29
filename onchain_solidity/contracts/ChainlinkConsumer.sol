// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {StatusState} from "./utils/StatusState.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";
import {Errors} from "./utils/Errors.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract ChainlinkConsumer is FunctionsClient, ConfirmedOwner {
  using FunctionsRequest for FunctionsRequest.Request;

  struct Request {
    address requesterAddress;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
  }

  StatusState.IssuerId public constant INVALID_ISSUER_ID = StatusState.IssuerId.wrap(0);

  event ResponseReceived(bytes32 requestId, bytes response, bytes error);

  bytes32 public donId; // DON ID for the Functions DON to which the requests are sent
  bytes32 public lastRequestId;
  bytes public lastResponse;
  bytes public lastError;
  string public source;

  mapping(bytes32 => Request) public requests;

  constructor(
    address router,
    bytes32 _donId,
    string memory _source
  ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
    donId = _donId;

    if (bytes(_source).length == 0) revert Errors.EmptySource();
    source = _source;
  }

  /**
   * @notice Set the DON ID
   * @param newDonId New DON ID
   */
  function setDonId(bytes32 newDonId) external onlyOwner {
    donId = newDonId;
  }

  function getSource() external view returns (string memory) {
    return source;
  }

  function setSource(string calldata _source) external {
    if (bytes(_source).length == 0) revert Errors.EmptySource();
    source = _source;
  }

  function requestBSLStatus(
    address requesterAddress,
    string memory url,
    StatusState.BSLStatus memory lastStatusState,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    if (bytes(source).length == 0) revert Errors.EmptySource();

    if (requesterAddress == address(0)) revert Errors.InvalidRequesterAddress(requesterAddress);

    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);

    if (statusType == StatusState.StatusType.Invalid) revert Errors.InvalidStatusType(statusType);

    string[] memory args = new string[](5);
    args[0] = url;
    args[1] = Strings.toString(lastStatusState.status);
    args[2] = Strings.toString(lastStatusState.time);
    args[3] = Strings.toString(uint8(statusType));
    args[4] = Strings.toString(uint8(StatusState.StatusMechanism.BitStatusList));

    bytes[] memory emptyBytesArray;
    bytes32 requestId = this.sendRequest(
      source,
      FunctionsRequest.Location.Remote,
      bytes(""),
      args,
      emptyBytesArray,
      subscriptionId,
      callbackGasLimit
    );
    requests[requestId] = Request(requesterAddress, statusType, StatusState.StatusMechanism.BitStatusList);
    return requestId;
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
    Request memory request = requests[requestId];

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      IStatusRegistry registry = IStatusRegistry(request.requesterAddress);
      if (response.length > 0) {
        (uint64 time, uint64 status) = abi.decode(response, (uint64, uint64));
        registry.fulfillBSLStatus(requestId, request.statusType, StatusState.BSLStatus(time, status));
      } else {
        registry.fulfillBSLStatus(requestId, StatusState.StatusType.Invalid, StatusState.BSLStatus(0, 0));
      }
    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }
  }
}
