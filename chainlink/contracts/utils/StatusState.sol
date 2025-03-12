// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// import "hardhat/console.sol";

library StatusState {
  uint8 public constant BIG_BSL_STATUS_SIZE = 7;
  uint8 public constant MT_TREE_HEIGHT = 11;
  StatusState.IssuerId public constant INVALID_ISSUER_ID = StatusState.IssuerId.wrap(0);

  enum StatusType {
    Invalid,
    Issuance,
    Revocation
  }

  enum StatusMechanism {
    BitStatusList,
    MerkleTree,
    BigBitStatusList
  }

  type IssuerId is uint8;

  struct Issuer {
    string url;
    StatusMechanism statusMechanism;
  }

  struct BSLStatus {
    uint64 time;
    uint64 status;
  }

  function checkBSLStatusValidity(
    BSLStatus memory lastStatusState,
    BSLStatus memory newStatusState
  ) internal pure returns (bool) {
    return (lastStatusState.status & newStatusState.status) == lastStatusState.status;
  }

  struct BigBSLStatus {
    uint32 time;
    uint256[BIG_BSL_STATUS_SIZE] data;
  }

  function checkBigBSLStatusValidity(
    BigBSLStatus memory lastStatusState,
    BigBSLStatus memory newStatusState
  ) internal pure returns (bool) {
    // console.log("checkBigBSLStatusValidity");
    for (uint256 i = 0; i < BIG_BSL_STATUS_SIZE; i++) {
      if ((lastStatusState.data[i] & newStatusState.data[i]) != lastStatusState.data[i]) {
        return false;
      }
    }
    return true;
  }

  function convertBigBSLStatusToBytes(BigBSLStatus memory status) internal pure returns (bytes memory) {
    // console.log("convertBigBSLStatusToBytes");
    // console.log(status.time);
    // console.log(status.data.length);
    return abi.encode(status.time, status.data);
  }

  function convertBSLStatusToBytes(BSLStatus memory status) internal pure returns (bytes memory) {
    return abi.encode(status.time, status.status);
  }

  function decodeBSLStatus(bytes memory data) internal pure returns (BSLStatus memory) {
    BSLStatus memory status;
    (status.time, status.status) = abi.decode(data, (uint64, uint64));
    return status;
  }

  function decodeBigBSLStatus(bytes memory data) internal pure returns (BigBSLStatus memory) {
    BigBSLStatus memory status;
    (status.time, status.data) = abi.decode(data, (uint32, uint256[7]));
    return status;
  }

  function decodeBSLStatuses(bytes memory data) internal pure returns (BSLStatus[] memory) {
    return abi.decode(data, (BSLStatus[]));
  }

  function decodeBigBSLStatuses(bytes memory data) internal pure returns (BigBSLStatus[] memory) {
    return abi.decode(data, (BigBSLStatus[]));
  }



  struct MTStatus {
    uint32 time;
    uint32 height;
    uint256 data;
    // uint256[8] proof;
  }

  function decodeMTStatuses(bytes memory data) internal pure returns (MTStatus[] memory) {
    return abi.decode(data, (MTStatus[]));
  }

  function convertMTStatusToBytes(MTStatus memory status) internal pure returns (bytes memory) {
    return abi.encode(status);
  }

  function decodeMTStatus(bytes memory data) internal pure returns (MTStatus memory) {
    return abi.decode(data, (MTStatus));
  }

  function getInitialMTStatus() internal pure returns (MTStatus memory) {
    return MTStatus(0, MT_TREE_HEIGHT, 0);
  }

  struct MTStateProofResponse {
    uint32[5] times;
    uint256[5] roots;
  }
}
