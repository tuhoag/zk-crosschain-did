// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library StatusState {
  enum StatusType {
    Invalid,
    Issuance,
    Revocation
  }

  enum StatusMechanism {
    BitStatusList,
    MerkleTree
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
  ) public pure returns (bool) {
    return (lastStatusState.status & newStatusState.status) == lastStatusState.status;
  }
}
