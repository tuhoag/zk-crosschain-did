// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IStatusRegistry {
  function getLastStatus() external view returns (string memory);
}

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract ChainlinkVerifier {
  string public name;
  address public registryAddress;

  constructor(string memory _name, address _statusRegistryAddress) {
    name = _name;
    registryAddress = _statusRegistryAddress;
  }

  function getName() public view returns (string memory) {
    return name;
  }

  function getStatusFromRegistry() public view returns (string memory) {
    return IStatusRegistry(registryAddress).getLastStatus();
  }
}
