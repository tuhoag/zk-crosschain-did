// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// import "hardhat/console.sol";
import {StatusState} from "./utils/StatusState.sol";
import {IOracleConsumer} from "./utils/IOracleConsumer.sol";
import {IVerifier} from "./utils/IVerifier.sol";
import {Errors} from "./utils/Errors.sol";
import {OracleType} from "./utils/OracleType.sol";
import {IGroth16Verifier, IGroth16BigVerifier, IGroth16SingleStateVerifier, IGroth165MTStateTransitionVerifier, IGroth1610MTStateTransitionVerifier} from "./utils/IGroth16Verifier.sol";

/**
 * @title Chainlink Functions example on-demand consumer contract example
 */
contract StatusRegistry {
  struct Request {
    address requesterAddress;
    StatusState.IssuerId issuerId;
    StatusState.StatusType statusType;
    StatusState.StatusMechanism statusMechanism;
    OracleType oracleType;
  }

  StatusState.IssuerId public constant INVALID_ISSUER_ID = StatusState.IssuerId.wrap(0);

  event StatusUpdated(StatusState.IssuerId issuerId, StatusState.StatusType statusType);

  mapping(bytes32 => Request) public requests;
  mapping(StatusState.IssuerId => StatusState.Issuer) public issuers;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.BSLStatus)) public bslStatuses;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.BigBSLStatus)) public bbslStatuses;
  mapping(StatusState.IssuerId => mapping(StatusState.StatusType => StatusState.MTStatus[])) public mtStatuses;

  mapping(OracleType => IOracleConsumer) public oracleConsumers;
  IGroth16Verifier public stateTransitionVerifier;
  IGroth16BigVerifier public bigStateTransitionVerifier;
  IGroth16SingleStateVerifier public singleMTStateVerifier;
  IGroth1610MTStateTransitionVerifier public multiMTStateVerifier;

  constructor(address consumerAddress, address zkConsumerAddress) {
    oracleConsumers[OracleType.ChainlinkConsumer] = IOracleConsumer(consumerAddress);
    oracleConsumers[OracleType.ZKConsumer] = IOracleConsumer(zkConsumerAddress);

    // stateTransitionVerifier = IGroth16Verifier(stateTransitionVerifierAddress);
  }

  function setStateTransitionVerifierAddress(address verifierAddress) external {
    stateTransitionVerifier = IGroth16Verifier(verifierAddress);
  }

  function setBigStateTransitionVerifierAddress(address verifierAddress) external {
    bigStateTransitionVerifier = IGroth16BigVerifier(verifierAddress);
  }

  function setSingleMTStateTransitionVerifierAddress(address verifierAddress) external {
    singleMTStateVerifier = IGroth16SingleStateVerifier(verifierAddress);
  }

  function setMTStateTransitionVerifierAddress(address verifierAddress) external {
    multiMTStateVerifier = IGroth1610MTStateTransitionVerifier(verifierAddress);
  }

  function changeConsumerAddress(OracleType oracleType, address consumerAddress) external {
    if (oracleType == OracleType.ChainlinkConsumer) {
      oracleConsumers[OracleType.ChainlinkConsumer] = IOracleConsumer(consumerAddress);
    } else if (oracleType == OracleType.ZKConsumer) {
      oracleConsumers[OracleType.ZKConsumer] = IOracleConsumer(consumerAddress);
    } else {
      revert Errors.InvalidOracleType(oracleType);
    }
  }

  function getIssuer(StatusState.IssuerId issuerId) external view returns (StatusState.Issuer memory) {
    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert Errors.IssuerNotFound(issuerId);
    return issuer;
  }

  function addIssuer(
    StatusState.IssuerId issuerId,
    string calldata url,
    StatusState.StatusMechanism statusMechanism
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    if (bytes(url).length == 0) revert Errors.InvalidUrl(url);

    issuers[issuerId] = StatusState.Issuer(url, statusMechanism);

    if (statusMechanism == StatusState.StatusMechanism.MerkleTree) {
      // console.log("StatusRegistry: addIssuer MT initial status");
      StatusState.MTStatus memory status = StatusState.getInitialMTStatus();
      this.setMTStatus(issuerId, StatusState.StatusType.Issuance, status);
      this.setMTStatus(issuerId, StatusState.StatusType.Revocation, status);
    }
  }

  function getConsumerAddress(OracleType oracleType) external view returns (address) {
    return address(oracleConsumers[oracleType]);
  }

  function getBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.BSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    return bslStatuses[issuerId][statusType];
  }

  function setBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    bslStatuses[issuerId][statusType] = status;
  }

  function getBigBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.BigBSLStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    return bbslStatuses[issuerId][statusType];
  }

  function setBigBSLStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status
  ) external {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    bbslStatuses[issuerId][statusType] = status;
  }

  function getNumMTStatuses(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (uint256) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.MTStatus[] storage statuses = mtStatuses[issuerId][statusType];
    return statuses.length;
  }

  function setMTStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    StatusState.MTStatus memory status
  ) external {
    // console.log("StatusRegistry: setMTStatus");
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.MTStatus[] storage statuses = mtStatuses[issuerId][statusType];
    // console.log(statuses.length);
    if(statuses.length > 0 && status.time != 0) {
      if (statuses[statuses.length - 1].time >= status.time) revert Errors.InvalidMTStatusTime(statuses[statuses.length - 1].time, status.time);
    }

    statuses.push(status);
  }

  function getMTStatus(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (StatusState.MTStatus memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.MTStatus[] storage statuses = mtStatuses[issuerId][statusType];
    return statuses[statuses.length - 1];
  }

  function getPreviousStatusBytes(
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType
  ) external view returns (bytes memory) {
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert Errors.IssuerNotFound(issuerId);

    bytes memory previousStatusBytes;
    if (issuer.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
      StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(issuerId, statusType);
      previousStatusBytes = StatusState.convertBSLStatusToBytes(lastStatusState);
    } else if (issuer.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
      StatusState.BigBSLStatus memory lastStatusState = this.getBigBSLStatus(issuerId, statusType);
      previousStatusBytes = StatusState.convertBigBSLStatusToBytes(lastStatusState);
    } else if (issuer.statusMechanism == StatusState.StatusMechanism.MerkleTree) {
      // console.log("StatusRegistry: getPreviousStatusBytes from MT");
      StatusState.MTStatus memory lastStatusState = this.getMTStatus(issuerId, statusType);
      previousStatusBytes = StatusState.convertMTStatusToBytes(lastStatusState);
    } else {
      revert Errors.UnsupportedStatusMechanism(issuer.statusMechanism);
    }

    return previousStatusBytes;
  }

  function getDataSize() external pure returns (uint8) {
    return StatusState.BIG_BSL_STATUS_SIZE;
  }

  function requestStatus(
    address requesterAddress,
    StatusState.IssuerId issuerId,
    StatusState.StatusType statusType,
    bool refresh,
    OracleType oracleType,
    uint64 subscriptionId,
    uint32 callbackGasLimit
  ) external returns (bytes32) {
    // console.log("Status Registry: requestStatus");
    if (StatusState.IssuerId.unwrap(issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.InvalidIssuerId(issuerId);

    StatusState.Issuer memory issuer = issuers[issuerId];
    if (bytes(issuer.url).length == 0) revert Errors.IssuerNotFound(issuerId);


    bytes32 requestId;
    bytes memory previousStatusBytes = this.getPreviousStatusBytes(issuerId, statusType);
    // console.log("StatusRegistry: got previous status bytes");

    // console.log("StatusRegistry: request consumer. Is it chainlink %s, is it ZK %s", oracleType == OracleType.ChainlinkConsumer, oracleType == OracleType.ZKConsumer);

    if (refresh) {
      // console.log("StatusRegistry: request consumer");
      IOracleConsumer consumerContract = oracleConsumers[oracleType];
      // console.log("StatusRegistry: got consumer contract");
      requestId = consumerContract.requestStatus(
        address(this),
        issuer.url,
        statusType,
        issuer.statusMechanism,
        previousStatusBytes,
        subscriptionId,
        callbackGasLimit
      );

      // console.log(uint8(StatusState.StatusMechanism.BigBitStatusList));
      // console.log(uint8(issuer.statusMechanism));

      // console.log("StatusRegistry: request consumer requestId");
      requests[requestId] = Request(requesterAddress, issuerId, statusType, issuer.statusMechanism, oracleType);
    } else {
      requestId = bytes32(0);
      IVerifier verifier = IVerifier(requesterAddress);

      if (issuer.statusMechanism == StatusState.StatusMechanism.BitStatusList) {
        StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(issuerId, statusType);
        verifier.setBSLStatus(issuerId, statusType, lastStatusState);
      } else if (issuer.statusMechanism == StatusState.StatusMechanism.BigBitStatusList) {
        StatusState.BigBSLStatus memory lastStatusState = this.getBigBSLStatus(issuerId, statusType);
        verifier.setBigBSLStatus(issuerId, statusType, lastStatusState);
      } else if (issuer.statusMechanism == StatusState.StatusMechanism.MerkleTree) {
        StatusState.MTStatus memory lastStatusState = this.getMTStatus(issuerId, statusType);
        verifier.setMTStatus(issuerId, statusType, lastStatusState);
      } else {  // MerkleTree
        revert Errors.UnsupportedStatusMechanism(issuer.statusMechanism);
      }
    }

    return requestId;
  }

  function fulfillBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BSLStatus memory status
  ) external {
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(request.issuerId, statusType);

    if (!StatusState.checkBSLStatusValidity(lastStatusState, status)) revert Errors.InvalidBSLStatus(requestId);

    this.setBSLStatus(request.issuerId, statusType, status);
    IVerifier verifier = IVerifier(request.requesterAddress);
    verifier.setBSLStatus(request.issuerId, statusType, status);

    emit StatusUpdated(request.issuerId, statusType);
  }

  function fulfillBSLStatusWithProof(bytes32 requestId, StatusState.StatusType statusType, StatusState.BSLStatus memory status, uint256[8] memory proof) external {
    // console.log("StatusRegistry fulfillBSLStatusWithProof");
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    StatusState.BSLStatus memory lastStatusState = this.getBSLStatus(request.issuerId, statusType);
    uint256[4] memory publicInputs = [uint256(lastStatusState.time), uint256(status.time), uint256(lastStatusState.status), uint256(status.status)];

    // console.log("StatusRegistry fulfillBSLStatusWithProof Public input: ");
    // console.log(publicInputs[0], publicInputs[1], publicInputs[2], publicInputs[3]);
    // console.log("StatusRegistry fulfillBSLStatusWithProof Proof: ");
    // console.log(proof[0], proof[1], proof[2], proof[3]);
    // console.log(proof[4], proof[5], proof[6], proof[7]);


    // console.log("StatusRegistry prepare proof: %s %s %s %s %s %s %s %s", proof[0], proof[1], proof[2], proof[3], proof[4], proof[5], proof[6], proof[7]);
    try stateTransitionVerifier.verifyProof(proof, publicInputs) {
      // console.log("StatusRegistry verification successful");

      this.setBSLStatus(request.issuerId, statusType, status);
      // console.log("StatusRegistry set status");

      IVerifier verifier = IVerifier(request.requesterAddress);
      verifier.setBSLStatus(request.issuerId, statusType, status);
      emit StatusUpdated(request.issuerId, statusType);
    } catch {
      // console.log("StatusRegistry verification failed");
      revert Errors.InvalidBSLStatus(requestId);
    }
  }

  function fulfillBigBSLStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status
  ) external {
    // console.log("StatusRegistry: fulfillBigBSLStatus");
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    // console.log("StatusRegistry: getLastBigBSLStatus");
    StatusState.BigBSLStatus memory lastStatusState = this.getBigBSLStatus(request.issuerId, statusType);

    bool isValid = StatusState.checkBigBSLStatusValidity(lastStatusState, status);
    // console.log("StatusRegistry: checkBigBSLStatusValidity %s", isValid);
    if (!isValid) revert Errors.InvalidBSLStatus(requestId);

    // console.log("StatusRegistry: setBigBSLStatus");
    this.setBigBSLStatus(request.issuerId, statusType, status);
    IVerifier verifier = IVerifier(request.requesterAddress);
    verifier.setBigBSLStatus(request.issuerId, statusType, status);

    emit StatusUpdated(request.issuerId, statusType);
  }

  function fulfillBigBSLStatusWithProof(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.BigBSLStatus memory status,
    uint256[8] memory proof
  ) external {
    // console.log("StatusRegistry: fulfillBigBSLStatusWithProof");

    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    // console.log("StatusRegistry: getLastBigBSLStatus");
    StatusState.BigBSLStatus memory lastStatusState = this.getBigBSLStatus(request.issuerId, statusType);
    uint256[16] memory publicInputs;
    publicInputs[0] = uint256(lastStatusState.time);
    publicInputs[1] = uint256(status.time);

    for (uint256 i = 0; i < StatusState.BIG_BSL_STATUS_SIZE; i++) {
      publicInputs[i + 2] = lastStatusState.data[i];
      publicInputs[i + 2 + StatusState.BIG_BSL_STATUS_SIZE] = status.data[i];
    }

    try bigStateTransitionVerifier.verifyProof(proof, publicInputs) {
      // console.log("StatusRegistry: verification successful");

      this.setBigBSLStatus(request.issuerId, statusType, status);
      // console.log("StatusRegistry: set status");

      IVerifier verifier = IVerifier(request.requesterAddress);
      verifier.setBigBSLStatus(request.issuerId, statusType, status);
      emit StatusUpdated(request.issuerId, statusType);
    } catch {
      // console.log("StatusRegistry verification failed");
      revert Errors.InvalidBSLStatus(requestId);
    }
  }

  function fulfillMTStatus(
    bytes32 requestId,
    StatusState.StatusType statusType,
    StatusState.MTStatus memory status,
    uint256[8] memory proof
  ) external {
    // console.log("StatusRegistry: fulfillMTStatus");
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    StatusState.MTStatus memory lastStatusState = this.getMTStatus(request.issuerId, statusType);

    uint256[4] memory publicInputs;
    publicInputs[0] = uint256(lastStatusState.time);
    publicInputs[1] = uint256(status.time);
    publicInputs[2] = lastStatusState.data;
    publicInputs[3] = status.data;

    // console.log("StatusRegistry: fulfillMTStatus verifyProof");
    try singleMTStateVerifier.verifyProof(proof, publicInputs) {
      // console.log("StatusRegistry: fulfillMTStatus verification successful");
      this.setMTStatus(request.issuerId, statusType, status);
      IVerifier verifier = IVerifier(request.requesterAddress);
      verifier.setMTStatus(request.issuerId, statusType, status);
      emit StatusUpdated(request.issuerId, statusType);
    } catch {
      revert Errors.InvalidBSLStatus(requestId);
    }
  }

  function fulfillMTStatusWithProof(
    bytes32 requestId,
    StatusState.StatusType statusType,
    uint32[10] memory times,
    uint256[10] memory roots,
    uint256[8] memory proof
  ) external {
    // console.log("StatusRegistry: fulfillMTStatusWithProof");
    Request memory request = requests[requestId];
    if (StatusState.IssuerId.unwrap(request.issuerId) == StatusState.IssuerId.unwrap(INVALID_ISSUER_ID))
      revert Errors.RequestNotFound(requestId);

    StatusState.MTStatus memory lastStatusState = this.getMTStatus(request.issuerId, statusType);
    uint256[22] memory publicInputs;
    publicInputs[0] = uint256(lastStatusState.time);
    publicInputs[11] = uint256(lastStatusState.data);
    for (uint256 i = 0; i < 10; i++) {
      publicInputs[i + 1] = uint256(times[i]);
      publicInputs[i + 12] = uint256(roots[i]);
    }

    // for (uint256 k = 0; k < 22; k++) {
    //   console.log(publicInputs[k]);
    // }

    // console.log("StatusRegistry: fulfillMTStatusWithProof verifyProof");
    try multiMTStateVerifier.verifyProof(proof, publicInputs) {
      // console.log("StatusRegistry: fulfillMTStatusWithProof verification successful");
      // IVerifier verifier = IVerifier(request.requesterAddress);

      for (uint256 j = 0; j < 10; j++) {
        StatusState.MTStatus memory status = StatusState.MTStatus(times[j], lastStatusState.height, roots[j]);
        this.setMTStatus(request.issuerId, statusType, status);

      //   verifier.setMTStatus(request.issuerId, statusType, status);
      }
      emit StatusUpdated(request.issuerId, statusType);
    } catch {
      revert Errors.InvalidBSLStatus(requestId);
    }
  }
}
