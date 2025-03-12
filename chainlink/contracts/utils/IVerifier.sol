// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatusState} from "./StatusState.sol";

interface IVerifier {
  function setBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external;

  function setBigBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status
  ) external;

  function setMTStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.MTStatus memory status
  ) external;

  // function fulfillBSLStatus(
  //   StatusState.IssuerId issuerId,
  //   StatusState.StatusType statusType,
  //   StatusState.BSLStatus memory status
  // ) external;

  // function fulfillBigBSLStatus(
  //   StatusState.IssuerId issuerId,
  //   StatusState.StatusType statusType,
  //   StatusState.BigBSLStatus memory status
  // ) external;
}
