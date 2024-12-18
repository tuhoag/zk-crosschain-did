import { ethers, network } from "hardhat";
import { Contract } from "ethers";
import fs, { stat } from "fs";
import { getChainId, getContracts, getDeployments } from "./utils";
import { ZKOracleManager } from "../typechain-types";


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
        // console.log(`Request ${requestId} processed with status ${status}`);
        // get request from request id
        console.log(`ZKOracleManager: event RequestReceived: ${requestId}`);
        const request = await contracts.ZKOracleManager.getRequestById(requestId);
        const statuses = await handleRequest(request);
        console.log(statuses);

        await updateStatusesToContract(contracts, request, statuses);

        return request;
    });

    contracts.ZKOracleManager.on("StatusReceived", async (args, status) => {
        // console.log(`Request ${requestId} processed with status ${status}`);
        // get request from request id
        console.log(`ZKOracleManager: event StatusReceived: ${args}`);
        console.log(args);
    });

    contracts.StatusRegistry.on("StatusUpdated", async (args, status) => {
        console.log(`StatusRegistry: event StatusUpdated: ${args}`);
    });

    contracts.Verifier.on("StatusUpdated", async (args, args2) => {
        console.log(`Verifier: event StatusUpdated: ${args} ${args2}`);

        const status = await contracts.Verifier.getBSLStatus(data.issuerIds[0], data.statusType);
        console.log("Status: ");
        console.log(status);
    });
}

function buildUrl(request: ZKOracleManager.Request) {
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
    let url = `${request.url}/statuses/${statusMechanismIndex}/${statusTypeIndex}?time=${request.lastStatusState.time}`;
    // http://localhost:3000/statuses/bsl/issuance?time=0
    console.log(`url: ${url}`)
    return url;
}

async function handleRequest(request: ZKOracleManager.Request) {
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

async function updateStatusesToContract(contracts: { [key: string]: Contract }, request: ZKOracleManager.Request, statuses: any) {
    // await updateLastStatusScenario(contracts, request, statuses);
    await updateStatusesScenario(contracts, request, statuses);
}

async function updateStatusesScenario(contracts: { [key: string]: Contract }, request: ZKOracleManager.Request, statuses: any) {
    let newStatuses: { id: number, status: number }[] = [];
    statuses.forEach((status: any) => {
        newStatuses.push({time: status.time, status: Buffer.from(status.status, "base64").readBigInt64BE(0)});
    });


    // console.log(`decodedStatus: ${decodedStatus}`);
    const statusType = "tuple(uint64 time, uint64 status)[]";
    const encodedStatus = ethers.utils.defaultAbiCoder.encode(
        [statusType],
        [newStatuses]
    );

    console.log(`encodedStatus: ${encodedStatus}`);
    const requestTx = await contracts.ZKOracleManager.fulfillRequestWithAllStatuses(
        request.requestId,
        encodedStatus,
        "0x00"
    );

    const receipt = await requestTx.wait(1);
    console.log(`Fulfill multiple statuses Gas used: ${receipt.gasUsed.toString()}`);
}

async function updateLastStatusScenario(contracts: { [key: string]: Contract }, request: ZKOracleManager.Request, statuses: any) {
    const lastStatus = statuses[statuses.length - 1];
    console.log(`lastStatus`);
    // console.log(lastStatus);
    const decodedStatus = Buffer.from(lastStatus.status, "base64").readBigInt64BE(0);
    console.log(`decodedStatus: ${decodedStatus}`);
    const encodedStatus = ethers.utils.defaultAbiCoder.encode(
        ["uint64", "uint64"],
        [lastStatus.time, decodedStatus]
    );

    const requestTx = await contracts.ZKOracleManager.fulfillRequestWithLastStatus(
        request.requestId,
        encodedStatus,
        "0x00"
    );

    const receipt = await requestTx.wait(1);
    console.log(`Fulfill single Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function requestStatus(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = 0;
    await contracts.Verifier.setSubscriptionId(subscriptionId);
    console.log(`Verifier subscriptionId set to ${await contracts.Verifier.getSubscriptionId()}`);

    const requestTx = await contracts.Verifier.requestStatus(
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
    await contracts.Verifier.setSubscriptionId(data.subscriptionId);

    await contracts.StatusRegistry.addIssuer(1, "http://localhost:3000", 0);
}

async function main() {
    const chainId = await getChainId();
    const subscriptionId = 0;
    const contracts = await getContracts(chainId);
    const data = {
        issuerIds: [1],
        statusType: 1,
        subscriptionId: 0,
        oracleType: 1,
        refresh: true,
    };

    await initContract(contracts, data);

    await simulateLocalZKOracle(contracts);

    await listenForEvents(contracts, data);

    await test(contracts);
    await requestStatus(contracts, data);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});