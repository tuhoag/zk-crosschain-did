// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
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

    if (bytes(_source).length == 0) revert Errors.InvalidSource();
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
    if (bytes(_source).length == 0) revert Errors.InvalidSource();
    source = _source;
  }

  function requestStatus(
    address requesterAddress,
    string memory url,
    StatusState.StatusType statusType,
    StatusState.StatusMechanism statusMechanism,
    bytes memory lastStatusState,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    // console.log("Chainlink Consumer: requestStatus");
    if (bytes(source).length == 0) revert Errors.InvalidSource();

    if (requesterAddress == address(0)) revert Errors.InvalidRequesterAddress(requesterAddress);

    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);

    if (statusType == StatusState.StatusType.Invalid) revert Errors.InvalidStatusType(statusType);

    string[] memory args = new string[](5);
    args[0] = url;
    args[1] = Strings.toString(uint8(statusType));
    args[2] = Strings.toString(uint8(statusMechanism));

    bytes[] memory bytesArgs = new bytes[](1);
    bytesArgs[0] = lastStatusState;

    bytes32 requestId = this.sendRequest(
      source,
      FunctionsRequest.Location.Remote,
      bytes(""),
      args,
      bytesArgs,
      subscriptionId,
      callbackGasLimit
    );
    requests[requestId] = Request(requesterAddress, statusType, statusMechanism);
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
    // console.log("Chainlink Consumer: sendRequest");
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

    // console.log("Chainlink Consumer: sendRequest: args");
    // console.log(args[0]);
    // console.log(args[1]);
    // console.log(args[2]);
    // console.log("Chainlink Consumer: sendRequest: bytesArgs");
    // console.log(bytesArgs[0].length);
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
    // console.log("Chainlink Consumer: fulfillRequest");

    // console.log(response.length);
    if (response.length == 0) {
      // console.log("Chainlink Consumer: WrongOracleExecution");
      revert Errors.WrongOracleExecution(err);
    }

    // console.log("Chainlink Consumer: emit ResponseReceived");
    // emit ResponseReceived(requestId, response, err);

    // console.log("Chainlink Consumer: get stored request information");
    Request memory request = requests[requestId];

    IStatusRegistry registry = IStatusRegistry(request.requesterAddress);

    // console.log(uint8(request.statusMechanism));
    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      // console.log("Chainlink Consumer: fulfillRequest: BitStatusList");
      StatusState.BSLStatus memory newStatus = StatusState.decodeBSLStatus(response);
      registry.fulfillBSLStatus(requestId, request.statusType, newStatus);
    } else if (request.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
      // console.log("Chainlink Consumer: fulfillRequest: BigBitStatusList");
      StatusState.BigBSLStatus memory newStatus = StatusState.decodeBigBSLStatus(response);
      registry.fulfillBigBSLStatus(requestId, request.statusType, newStatus);
    }
    else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }
  }
}
