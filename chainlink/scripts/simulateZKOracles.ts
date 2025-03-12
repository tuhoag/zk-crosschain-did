import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";
import fs, { stat } from "fs";
import { getChainId, getContracts, getDeployments, ResponseType } from "./utils";
import { ZKOracleManager, StatusRegistry } from "../typechain-types";
import { Circuit } from "./gnark/gnark";
import { StateTransitionInputs } from "./gnark/stateTransitionInputs";
import { BigStateTransitionInputs } from "./gnark/bigStateTransitionInputs";
import { DIDStatus } from "./did/did";
import { BSLStatus } from "./did/bslStatus";
import { BigBSLStatus } from "./did/bigBSLStatus";
import { MTStatus } from "./did/mtStatus";
import { MTStateTransitionInputs } from "./gnark/mtStateTransitionInputs";

const setup = {
    numStatuses: 10,
    dataSize: 7,
}

async function getAllOracles(contracts: { [key: string]: Contract }) {
    const oracles = await contracts.ZKOracleManager.getOracles();
    console.log(oracles);
    return oracles;
}

async function registerOracle(contracts: { [key: string]: Contract }) {
    // uint8 oracleId, string memory url, uint64 amount
    const oracleId = 0;
    const oracleUrl = `http://oracle${oracleId}:8000`;
    const oracleAmount = 100;

    // register oracle
    const tx = await contracts.ZKOracleManager.addOracle(oracleId, oracleUrl, oracleAmount);
    tx.wait(1);

    // console.log(`Oracle registered with tx hash: ${tx.hash}`);
}

async function listenForEvents(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    contracts.ZKOracleManager.on("RequestReceived", async (requestId, status) => {
        // get request from request id
        console.log(`Oracle: Got RequestReceived from ZKOracleManager: ${requestId}`);
        const request = await contracts.ZKOracleManager.getRequestById(requestId);
        const dataSize = await contracts.StatusRegistry.getDataSize();
        const statuses = await simulateRequest(request, dataSize, setup.numStatuses);
        // const statuses = await handleRequest(request);
        if (statuses.length != setup.numStatuses + 1) {
            // console.log(request.)
            throw new Error(`Invalid number of statuses: ${statuses.length}`);
        }
        // console.log(statuses);

        await updateStatusesToContract(contracts, request, statuses);

        return request;
    });

    // contracts.StatusRegistry.on("StatusUpdated", async (args, status) => {
    //     console.log(`StatusRegistry: event StatusUpdated: ${args}`);
    // });

    contracts.SSIVerifier.on("StatusUpdated", async (args, args2) => {
        console.log(`Verifier: event StatusUpdated: ${args} ${args2}`);

        // const status = await contracts.SSIVerifier.getBSLStatus(data.issuerIds[0], data.statusType);
        // console.log("Status: ");
        // console.log(status);

        // const bigStatus = await contracts.SSIVerifier.getMTStatus(data.issuerIds[0], data.statusType);
        // console.log("BigStatus: ");
        // console.log(bigStatus);
    });
}

function buildUrl(request: ZKOracleManager.RequestStruct) {
    let statusMechanismIndex;
    if (request.statusMechanism == 0) {
        statusMechanismIndex = "bsl"
    } else if (request.statusMechanism == 1) {
        statusMechanismIndex = "mt"
    } else {
        throw new Error(`Invalid status mechanism: ${request.statusMechanism}`)
    }

    let statusTypeIndex;
    if (request.statusType == 1) {
        statusTypeIndex = "issuance"
    } else if (request.statusType == 2) {
        statusTypeIndex = "revocation"
    } else {
        throw new Error(`Invalid status type: ${request.statusType}`)
    }

    // Use multiple APIs & aggregate the results to enhance decentralization
    let url = `${request.url}/statuses/${statusMechanismIndex}/${statusTypeIndex}?time=${request.lastStatusState}`;
    // http://localhost:3000/statuses/bsl/issuance?time=0
    console.log(`url: ${url}`)
    return url;
}

async function simulateRequest(request: ZKOracleManager.RequestStruct, dataSize: number, numStatuses: number) {
    console.log(`Simulating request ${request.requestId}`);
    console.log(`request mechanism: ${request.statusMechanism}`);


    let statuses: DIDStatus[] = [];
    let previousStatus: DIDStatus;

    if (request.statusMechanism == 0) {
        previousStatus = BSLStatus.decode(await request.lastStatusState);
    } else if (request.statusMechanism == 2) {
        previousStatus = BigBSLStatus.decode(await request.lastStatusState, dataSize);
    } else if (request.statusMechanism == 1) {
        previousStatus = MTStatus.decode(await request.lastStatusState);
    } else {
        throw new Error(`Invalid status mechanism: ${request.statusMechanism}`)
    }

    console.log(`previous time: ${previousStatus.time}`);
    statuses.push(previousStatus);
    for (let i = 0; i < numStatuses; i++) {
        const curStatus = await previousStatus.generateNextStatus();
        statuses.push(curStatus);
        previousStatus = curStatus;
    }

    console.log(statuses.map((status) => status.time));
    console.log(statuses.length);

    return statuses;
}

async function handleRequest(request: ZKOracleManager.RequestStruct) {
    console.log(`Handling request ${request.requestId}`);
    const url = buildUrl(request);
    const result = await fetch(url);

    if (result.status != 200) {
        throw new Error(`Failed to fetch status from ${url}`);
    }
    const statuses = await result.json();
    console.log(statuses);
    // console.log(request);
    return statuses;
}

async function updateStatusesToContract(contracts: { [key: string]: Contract }, request: ZKOracleManager.RequestStruct, statuses: DIDStatus[]) {
    // await updateLastStatusScenario(contracts, request, statuses);
    // await updateStatusesScenario(contracts, request, statuses);
    await updateLastStatusWithProof(contracts, request, statuses);
}

async function updateStatusesScenario(contracts: { [key: string]: Contract }, request: ZKOracleManager.RequestStruct, statuses: DIDStatus[]) {
    let encodedStatuses;
    const newStatuses = statuses.slice(1);
    if (statuses[0] instanceof BSLStatus) {
        encodedStatuses = BSLStatus.encodeStatuses(newStatuses as BSLStatus[]);
    } else if (statuses[0] instanceof BigBSLStatus) {
        encodedStatuses = BigBSLStatus.encodeStatuses(newStatuses as BigBSLStatus[]);
    } else if (statuses[0] instanceof MTStatus) {
        encodedStatuses = MTStatus.encodeStatuses(newStatuses as MTStatus[]);
    } else {
        throw new Error("Invalid status type");
    }

    console.log(`encodedStatus: ${encodedStatuses}`);
    const requestTx = await contracts.ZKOracleManager.fulfillRequest(
        request.requestId,
        ResponseType.AllStatuses,
        encodedStatuses,
        "0x00"
    );

    const receipt = await requestTx.wait(1);
    console.log(`Fulfill multiple statuses Gas used: ${receipt.gasUsed.toString()}`);
}

async function updateLastStatusScenario(contracts: { [key: string]: Contract }, request: ZKOracleManager.RequestStruct, statuses: DIDStatus[]) {
    const lastStatus = statuses[statuses.length - 1];
    console.log(`lastStatus`);
    console.log(lastStatus);

    const encodedStatus = lastStatus.encode();
    const requestTx = await contracts.ZKOracleManager.fulfillRequest(
        request.requestId,
        ResponseType.LastStatus,
        encodedStatus,
        "0x00"
    );

    const receipt = await requestTx.wait(1);
    console.log(`Fulfill single Status Gas used: ${receipt.gasUsed.toString()}`);
}


async function updateLastStatusWithProof(contracts: { [key: string]: Contract }, request: ZKOracleManager.RequestStruct, statuses: DIDStatus[]) {
    console.log("Oracle: updateLastStatusWithProof");
    let inputs;
    let circuitName;
    let publicInputType;
    let encodedTypes: any[];
    if (statuses[0] instanceof BSLStatus) {
        inputs = StateTransitionInputs.readFromRawStatuses(statuses);
        circuitName = "StateTransition";
        encodedTypes = ["uint256[8]", "uint64[2]"];

    } else if (statuses[0] instanceof BigBSLStatus) {
        inputs = BigStateTransitionInputs.readFromRawStatuses(statuses);
        circuitName = "BigStateTransition";
        publicInputType = inputs.getEncodeTypeOfPublicInputsForRegistry();
        encodedTypes = ["uint256[8]", publicInputType];
        console.log(`publicInputType: ${publicInputType}`);

    } else if (statuses[0] instanceof MTStatus) {
        inputs = MTStateTransitionInputs.readFromRawStatuses(statuses);
        console.log(inputs.transitionTime);
        // inputs.exportToFile("../circuits-go/output/input.json");
        circuitName = "MTStateTransition";
        encodedTypes = ["uint256[8]", `tuple(uint32[${setup.numStatuses}] times, uint256[${setup.numStatuses}] roots)`];
        // console.log
    } else {
        throw new Error("Invalid status type");
    }

    console.log(circuitName);
    console.log(statuses.length);
    console.log(inputs.transitionTime.length);
    const circuit = new Circuit(circuitName);
    const proof = await circuit.generateProof(inputs);

    console.log("Oracle: Encoding proof and inputs");
    const proofData = proof.generateCalldata();
    const publicInputData = inputs.generatePublicInputsCalldataForRegistry();

    console.log(`Proof: ${publicInputData.length}`);
    // console.log(publicInputData);
    const encodedStatus = ethers.utils.defaultAbiCoder.encode(
        encodedTypes,
        [proofData, publicInputData]
    );

    console.log("Oracle: Fulfilling request with proof and inputs");
    const requestTx = await contracts.ZKOracleManager.fulfillRequest(
        request.requestId,
        ResponseType.LastStatusWithProof,
        encodedStatus,
        "0x00"
    );

    const receipt = await requestTx.wait(1);
    console.log(`Fulfill Proof Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function requestStatus(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = 0;
    await contracts.SSIVerifier.setSubscriptionId(subscriptionId);
    console.log(`Verifier subscriptionId set to ${await contracts.SSIVerifier.getSubscriptionId()}`);

    const requestTx = await contracts.SSIVerifier.requestStatus(
        data.issuerIds[0],
        data.statusType,
        data.refresh,
        data.oracleType,
        300_000,
        { gasLimit: 1_750_000 }
    );
    console.log("Verifier requestStatus called");

    const receipt = await requestTx.wait(1);
    console.log(`Request Gas used: ${receipt.gasUsed.toString()}`);
}

async function simulateLocalZKOracle(contracts: { [key: string]: Contract }) {
    await registerOracle(contracts);
    await getAllOracles(contracts);
}

async function test(contracts: { [key: string]: Contract }) {
    const chainlinkConsumerAddress = await contracts.StatusRegistry.getConsumerAddress(0);
    const zkConsumerAddress = await contracts.StatusRegistry.getConsumerAddress(1);

    console.log(`chainlinkConsumerAddress: ${chainlinkConsumerAddress}`);
    console.log(`zkConsumerAddress: ${zkConsumerAddress}`);
}

async function initContract(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    await contracts.SSIVerifier.setSubscriptionId(data.subscriptionId);

    await contracts.StatusRegistry.addIssuer(1, "http://localhost:3000", 0);
    await contracts.StatusRegistry.addIssuer(2, "http://localhost:3000", 2);
    await contracts.StatusRegistry.addIssuer(3, "http://localhost:3000", 1);
}

async function main() {
    const chainId = await getChainId();
    const subscriptionId = 0;
    const contracts = await getContracts(chainId);
    const data = {
        issuerIds: [3],
        statusType: 1,
        subscriptionId: 0,
        oracleType: 1,
        refresh: true,
        height: 3,
    };

    await initContract(contracts, data);

    await simulateLocalZKOracle(contracts);

    await listenForEvents(contracts, data);

    // await test(contracts);
    await requestStatus(contracts, data);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});