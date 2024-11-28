// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./utils/StatusState.sol";
import {IStatusRegistry} from "./utils/IStatusRegistry.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract Verifier {
  string public name;
  IStatusRegistry public registryContract;

  constructor(string memory _name, address _statusRegistryAddress) {
    name = _name;
    registryContract = IStatusRegistry(_statusRegistryAddress);
  }

  function getName() public view returns (string memory) {
    return name;
  }

  function requestStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external {
    registryContract.requestStatus(issuerId, statusType, subscriptionId, callbackGasLimit);
  }
}
