// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";

import {StatusState} from "./utils/StatusState.sol";
import {Errors} from "./utils/Errors.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";


contract ZKOracleManager {
  enum ResponseType {
    LastStatus,
    AllStatuses,
    LastStatusWithProof
  }
  struct Oracle {
    uint8 id;
    address oracleAddress;
    string url;
    uint64 amount;
  }

  struct Request {
    bytes32 requestId;
    address requesterAddress;
    string url;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
    bytes lastStatusState;
    uint64 subscriptionId;
    uint32 callbackGasLimit;
    uint8[] aggregatorIds;
    uint8 numAgreements;
  }

  // event RequestReceived(string url, StatusState.BSLStatus lastStatusState, StatusState.StatusType statusType, uint32 callbackGasLimit);
  event RequestReceived(bytes32 requestId);
  event OracleAdded(Oracle oracle);
  event ResponseReceived(bytes32 requestId, bytes response, bytes err);

  mapping(uint8 => Oracle) public oracles;
  uint8[] public oracleIds;
  Request[] public requests;
  uint8 public numAggregators;
  uint8 public currentAggregatorIndex;
  uint8 public numAgreements;

  constructor(uint8 _numAggregators, uint8 _numAgreements) {
    currentAggregatorIndex = 0;
    numAggregators = _numAggregators;
    numAgreements = _numAgreements;
  }

  function getNumOracles() external view returns (uint256) {
    return oracleIds.length;
  }

  function addOracle(uint8 oracleId, string memory url, uint64 amount) external {
    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);
    if (amount == 0) revert Errors.InvalidDeposit(amount);

    Oracle memory oldOracle = oracles[oracleId];
    if (bytes(oldOracle.url).length != 0) {
      if (oldOracle.id != oracleId ||
        oldOracle.oracleAddress != msg.sender ||
        keccak256(abi.encodePacked(oldOracle.url)) != keccak256(abi.encodePacked(url)))
      revert Errors.OracleAlreadyExists(oracleId);
    } else {
      Oracle memory oracle = Oracle(oracleId, msg.sender, url, amount);
      oracles[oracleId] = oracle;
      oracleIds.push(oracleId);

      emit OracleAdded(oracle);
    }
  }

  function getOracle(uint8 oracleId) external view returns (Oracle memory) {
    Oracle memory oracle = oracles[oracleId];
    if (bytes(oracle.url).length == 0) revert Errors.OracleNotFound(oracleId);

    return oracle;
  }

  function getOracles() external view returns (Oracle[] memory) {
    Oracle[] memory result = new Oracle[](oracleIds.length);
    for (uint256 i = 0; i < oracleIds.length; i++) {
      result[i] = oracles[oracleIds[i]];
    }

    return result;
  }

  function getRequestById(bytes32 requestId) external view returns (Request memory) {
    uint256 index = uint256(requestId);

    // console.log("getRequestById");
    // console.log(requests.length);
    // console.log(index);
    // console.log(index >= requests.length);

    if (index >= requests.length) revert Errors.RequestNotFound(requestId);

    return requests[index];
  }

  function getAggregators() internal view returns (uint8[] memory aggregatorIds) {
    uint8[] memory result = new uint8[](numAggregators);
    for (uint8 i = 0; i < numAggregators; i++) {
      uint8 oracleIndex = (currentAggregatorIndex + i) % uint8(oracleIds.length);
      result[i] = oracleIds[oracleIndex];
    }

    return result;
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
    // assign aggregators
    // console.log("ZK Oracle: requestStatus");
    uint8[] memory aggregatorIds = getAggregators();
    currentAggregatorIndex += 1;

    bytes32 requestId = bytes32(requests.length);

    // uint8[] aggregatorIds;
    // uint8 numAgreements;

    Request memory request = Request(requestId, requesterAddress, url, statusType, statusMechanism, lastStatusState, subscriptionId, callbackGasLimit, aggregatorIds, numAgreements);
    requests.push(request);

    emit RequestReceived(requestId);
    return requestId;
  }

  function fulfillRequest(bytes32 requestId, ResponseType responseType, bytes memory response, bytes memory err) external {
    // console.log("ZKOracleManager fulfillRequest");
    // console.log(uint(responseType));

    if (response.length == 0) {
      revert Errors.WrongOracleExecution(err);
    }

    if (responseType == ResponseType.LastStatus) {
      this.fulfillRequestWithLastStatus(requestId, response, err);
    } else if (responseType == ResponseType.AllStatuses) {
      this.fulfillRequestWithAllStatuses(requestId, response, err);
    } else if (responseType == ResponseType.LastStatusWithProof) {
      this.fulfillRequestWithProof(requestId, response, err);
    } else {
      revert Errors.UnsupportedResponseType(uint8(responseType));
    }
    // Request memory request = this.getRequestById(requestId);

    // if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
    //   IStatusRegistry registry = IStatusRegistry(request.requesterAddress);
    //   if (response.length > 0) {
    //     (uint64 time, uint64 status) = abi.decode(response, (uint64, uint64));
    //     emit StatusReceived(requestId, time, status);
    //     registry.fulfillBSLStatus(requestId, request.statusType, StatusState.BSLStatus(time, status));
    //   } else {
    //     registry.fulfillBSLStatus(requestId, StatusState.StatusType.Invalid, StatusState.BSLStatus(0, 0));
    //   }
    // } else {
    //   revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    // }

    emit ResponseReceived(requestId, response, err);
  }


  function fulfillRequestWithLastStatus(bytes32 requestId, bytes memory response, bytes memory err) external {
    // console.log("ZKOracleManager: fulfillRequestWithLastStatus");
    Request memory request = this.getRequestById(requestId);
    IStatusRegistry registry = IStatusRegistry(request.requesterAddress);

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      // console.log("ZKOracleManager: fulfillRequestWithLastStatus: BitStatusList");
      StatusState.BSLStatus memory newStatus = StatusState.decodeBSLStatus(response);
      registry.fulfillBSLStatus(requestId, request.statusType, newStatus);
    } else if (request.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
      // console.log("ZKOracleManager: fulfillRequestWithLastStatus: BigBitStatusList");
      StatusState.BigBSLStatus memory newStatus = StatusState.decodeBigBSLStatus(response);
      registry.fulfillBigBSLStatus(requestId, request.statusType, newStatus);
    } else if (request.statusMechanism == StatusState.StatusMechanism.MerkleTree) {
      // console.log("ZKOracleManager: fulfillRequestWithLastStatus: MerkleTree");
      StatusState.MTStatus memory newStatus = StatusState.decodeMTStatus(response);
      registry.fulfillMTStatus(requestId, request.statusType, newStatus);
    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }
  }

  function fulfillRequestWithAllStatuses(bytes32 requestId, bytes memory response, bytes memory err) external {
    // console.log("ZKOracleManager: fulfillRequestWithAllStatuses");
    Request memory request = this.getRequestById(requestId);
    IStatusRegistry registry = IStatusRegistry(request.requesterAddress);

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      // extract data from the response
      StatusState.BSLStatus[] memory statuses = StatusState.decodeBSLStatuses(response);
      for (uint8 i = 0; i < statuses.length; i++) {
        StatusState.BSLStatus memory status = statuses[i];
        registry.fulfillBSLStatus(requestId, request.statusType, status);
      }
    } else if (request.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
      // console.log("ZKOracleManager: fulfillRequestWithAllStatuses: BigBitStatusList");
      StatusState.BigBSLStatus[] memory statuses = StatusState.decodeBigBSLStatuses(response);
      // console.log(statuses.length);
      for (uint8 i = 0; i < statuses.length; i++) {
        StatusState.BigBSLStatus memory status = statuses[i];
        registry.fulfillBigBSLStatus(requestId, request.statusType, status);
      }
    } else if (request.statusMechanism == StatusState.StatusMechanism.MerkleTree) {
      // console.log("ZKOracleManager: fulfillRequestWithAllStatuses: MerkleTree");
      StatusState.MTStatus[] memory statuses = StatusState.decodeMTStatuses(response);
      for (uint8 i = 0; i < statuses.length; i++) {
        // console.log("ZKOracleManager: fulfillRequestWithAllStatuses: MerkleTree: fulfillMTStatus");
        // console.log(i);
        StatusState.MTStatus memory status = statuses[i];
        registry.fulfillMTStatus(requestId, request.statusType, status);
      }

    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }
  }

  struct MTStateProofResponse {
    uint32[10] times;
    uint256[10] roots;
  }

  function fulfillRequestWithProof(bytes32 requestId, bytes memory response, bytes memory err) external {
    // console.log("ZKOracleManager: fulfillRequestWithProof");
    Request memory request = this.getRequestById(requestId);
    IStatusRegistry registry = IStatusRegistry(request.requesterAddress);
    // console.log(uint8(request.statusMechanism));
    // console.log(uint8(StatusState.StatusMechanism.BigBitStatusList));

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      (uint256[8] memory proof, uint64[2] memory publicInputs) = abi.decode(response, (uint256[8], uint64[2]));

      // console.log("ZKOracleManager fulfillRequestWithProof: extracted proof and public inputs");
      StatusState.BSLStatus memory newStatus = StatusState.BSLStatus(uint64(publicInputs[0]), uint64(publicInputs[1]));

      registry.fulfillBSLStatusWithProof(requestId, request.statusType, newStatus, proof);
    } else if (request.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
      // console.log("ZKOracleManager: fulfillRequestWithProof: BigBitStatusList");
      (
        uint256[8] memory proof,
        StatusState.BigBSLStatus memory newStatus
      ) = abi.decode(response, (uint256[8], StatusState.BigBSLStatus));

      registry.fulfillBigBSLStatusWithProof(requestId, request.statusType, newStatus, proof);
    } else if (request.statusMechanism == StatusState.StatusMechanism.MerkleTree) {
      // console.log("ZKOracleManager: fulfillRequestWithProof: MerkleTree");

      (
        uint256[8] memory proof,
        MTStateProofResponse memory mtStateProofResponse
      ) = abi.decode(response, (uint256[8], MTStateProofResponse));

      // console.log(mtStateProofResponse.times.length);
      registry.fulfillMTStatusWithProof(requestId, request.statusType, mtStateProofResponse.times, mtStateProofResponse.roots, proof);
    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }

    emit ResponseReceived(requestId, response, err);
  }
}