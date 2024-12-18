// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

import {StatusState} from "./utils/StatusState.sol";
import {Errors} from "./utils/Errors.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";


contract ZKOracleManager {
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
    StatusState.BSLStatus lastStatusState;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
    uint64 subscriptionId;
    uint32 callbackGasLimit;
    uint8[] aggregatorIds;
    uint8 numAgreements;
  }

  // event RequestReceived(string url, StatusState.BSLStatus lastStatusState, StatusState.StatusType statusType, uint32 callbackGasLimit);
  event RequestReceived(bytes32 requestId);
  event OracleAdded(Oracle oracle);
  event ResponseReceived(bytes32 requestId, bytes response, bytes err);
  event StatusReceived(bytes32 requestId, uint64 time, uint64 status);

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

    console.log("getRequestById");
    console.log(requests.length);
    console.log(index);
    console.log(index >= requests.length);

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

// address requesterAddress,
//     string memory url,
//     StatusState.BSLStatus memory lastStatusState,
//     StatusState.StatusType statusType,
//     uint64 subscriptionId,
//     uint32 callbackGasLimit
//   ) external returns (bytes32);
  function requestBSLStatus(
    address requesterAddress,
    string memory url,
    StatusState.BSLStatus memory lastStatusState,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    // assign aggregators
    console.log("ZK Oracle: requestStatus");
    uint8[] memory aggregatorIds = getAggregators();
    currentAggregatorIndex += 1;

    bytes32 requestId = bytes32(requests.length);
    Request memory request = Request(requestId, requesterAddress, url, lastStatusState, statusType, StatusState.StatusMechanism.BitStatusList, subscriptionId, callbackGasLimit, aggregatorIds, numAgreements);
    requests.push(request);

    emit RequestReceived(requestId);
    return requestId;
  }

  function fulfillRequestWithLastStatus(bytes32 requestId, bytes memory response, bytes memory err) external {
    Request memory request = this.getRequestById(requestId);

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      IStatusRegistry registry = IStatusRegistry(request.requesterAddress);
      if (response.length > 0) {
        (uint64 time, uint64 status) = abi.decode(response, (uint64, uint64));
        emit StatusReceived(requestId, time, status);
        registry.fulfillBSLStatus(requestId, request.statusType, StatusState.BSLStatus(time, status));
      } else {
        registry.fulfillBSLStatus(requestId, StatusState.StatusType.Invalid, StatusState.BSLStatus(0, 0));
      }
    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }
  }

  function fulfillRequestWithAllStatuses(bytes32 requestId, bytes memory response, bytes memory err) external {
    Request memory request = this.getRequestById(requestId);

    if (request.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      IStatusRegistry registry = IStatusRegistry(request.requesterAddress);
      if (response.length > 0) {
        // extract data from the response
        StatusState.BSLStatus[] memory statuses = abi.decode(response, (StatusState.BSLStatus[]));
        for (uint8 i = 0; i < statuses.length; i++) {
          StatusState.BSLStatus memory status = statuses[i];
          emit StatusReceived(requestId, status.time, status.status);
          registry.fulfillBSLStatus(requestId, request.statusType, status);
        }
      } else {
        registry.fulfillBSLStatus(requestId, StatusState.StatusType.Invalid, StatusState.BSLStatus(0, 0));
      }
    } else {
      revert Errors.UnsupportedStatusMechanism(request.statusMechanism);
    }


    // send it to the registry



    emit ResponseReceived(requestId, response, err);
  }


}