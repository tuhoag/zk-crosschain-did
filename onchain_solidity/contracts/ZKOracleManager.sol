// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./utils/StatusState.sol";
import {Errors} from "./utils/Errors.sol";

contract ZKOracleManager {
  struct Oracle {
    uint8 id;
    address oracleAddress;
    string url;
    uint64 amount;
  }

  struct Request {
    address requesterAddress;
    string url;
    StatusState.BSLStatus lastStatusState;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
    uint64 subscriptionId;
    uint32 callbackGasLimit;
    uint8[] aggregatorIds;
  }

  // event RequestReceived(string url, StatusState.BSLStatus lastStatusState, StatusState.StatusType statusType, uint32 callbackGasLimit);
  event RequestReceived(bytes32 requestId);
  event OracleAdded(Oracle oracle);

  mapping(uint8 => Oracle) public oracles;
  uint8[] public oracleIds;
  Request[] public requests;
  uint8 numAggregators;
  uint8 currentAggregatorIndex;

  constructor() {
    // numOracles = 0;
    numAggregators = 4;
    currentAggregatorIndex = 0;
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

  function requestBSLStatus(
    address requesterAddress,
    string memory url,
    StatusState.BSLStatus memory lastStatusState,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    // assign aggregators
    uint8[] memory aggregatorIds = getAggregators();
    currentAggregatorIndex += 1;

    Request memory request = Request(requesterAddress, url, lastStatusState, statusType, StatusState.StatusMechanism.BitStatusList, subscriptionId, callbackGasLimit, aggregatorIds);
    bytes32 requestId = bytes32(requests.length);

    requests.push(request);

    emit RequestReceived(requestId);
    return requestId;
  }
}