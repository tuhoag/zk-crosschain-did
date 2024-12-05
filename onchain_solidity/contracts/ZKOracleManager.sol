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

  event RequestReceived();
  event OracleAdded(Oracle oracle);

  mapping(uint8 => Oracle) public oracles;

  uint8 public numOracles;

  constructor() {
    numOracles = 0;
  }

  function addOracle(string memory url, uint64 amount) external {
    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);
    if (amount == 0) revert Errors.InvalidDeposit(amount);

    uint8 oracleId = numOracles++;
    Oracle memory oldOracle = oracles[oracleId];
    if (bytes(oldOracle.url).length != 0) revert Errors.OracleNotFound(oracleId);

    Oracle memory oracle = Oracle(oracleId, msg.sender, url, amount);
    oracles[oracleId] = oracle;

    emit OracleAdded(oracle);
  }

  function getOracle(uint8 oracleId) external view returns (Oracle memory) {
    Oracle memory oracle = oracles[oracleId];
    if (bytes(oracle.url).length == 0) revert Errors.OracleNotFound(oracleId);

    return oracle;
  }
}