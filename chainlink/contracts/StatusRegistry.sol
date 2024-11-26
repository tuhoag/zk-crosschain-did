// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry is FunctionsClient, ConfirmedOwner {
  using FunctionsRequest for FunctionsRequest.Request;
  type IssuerId is uint8;

  IssuerId public constant INVALID_ISSUER_ID = IssuerId.wrap(0);

  error IssuerNotFound(IssuerId issuerId);
  error RequestNotFound(bytes32 requestId);
  error InvalidStatus(StatusState statusState);
  error InvalidIssuerId(IssuerId issuerId);
  error EmptySource();

  event StatusUpdated(IssuerId issuerId, StatusState status);
  event ResponseReceived(bytes32 requestId, bytes response, bytes error);

  bytes32 public donId; // DON ID for the Functions DON to which the requests are sent
  bytes32 public lastRequestId;
  bytes public lastResponse;
  bytes public lastError;
  string public source;

  // FunctionsRequest.Request public req;
  mapping(IssuerId => string) public issuerUrls;
  mapping(bytes32 => IssuerId) public issuerRequestIds;
  mapping(IssuerId => StatusState) public issuerStatuses;

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

  function getIssuerUrl(IssuerId issuerId) external view returns (string memory) {
    string memory url = issuerUrls[issuerId];
    if (bytes(url).length == 0) revert IssuerNotFound(issuerId);
    return url;
  }

  function getSource() external view returns (string memory) {
    return source;
  }

  function setSource(string calldata _source) external {
    if (bytes(_source).length == 0) revert EmptySource();
    source = _source;
  }

  function addIssuer(IssuerId issuerId, string calldata url) external onlyOwner {
    if (IssuerId.unwrap(issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert InvalidIssuerId(issuerId);
    issuerUrls[issuerId] = url;
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
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external {
    if (bytes(source).length == 0) revert EmptySource();

    // get issuer URL
    string memory url = issuerUrls[issuerId];
    StatusState memory lastStatusState = issuerStatuses[issuerId];

    string[] memory args = new string[](3);
    args[0] = url;
    args[1] = lastStatusState.status;
    args[2] = Strings.toString(lastStatusState.time);

    bytes[] memory emptyBytesArray;
    bytes32 requestId = this.sendRequest(source, FunctionsRequest.Location.Remote, bytes(""), args, emptyBytesArray, subscriptionId, callbackGasLimit);
    issuerRequestIds[requestId] = issuerId;
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
      (uint64 time, string memory status) = abi.decode(
        response,
        (uint64, string)
      );

      IssuerId issuerId = issuerRequestIds[requestId];
      if (IssuerId.unwrap(issuerId) == IssuerId.unwrap(INVALID_ISSUER_ID)) revert RequestNotFound(requestId);

      // StatusState memory lastStatusState = issuerStatuses[issuerId];

      StatusState memory newStatusState = StatusState(
        time,
        status
      );
      // check validity of status
      // if (!checkValidity(lastStatusState, newStatusState)) revert InvalidStatus(newStatusState);

      issuerStatuses[issuerId] = newStatusState;
      emit StatusUpdated(issuerId, newStatusState);
    }
  }

  function checkValidity(
    StatusState memory lastStatusState,
    StatusState memory newStatusState
  ) public pure returns (bool) {
    return true;
  }
}
