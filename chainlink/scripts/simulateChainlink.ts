import hre from "hardhat";
import { ethers, network, run } from "hardhat";
import fs from "fs";
import { Location } from "@chainlink/functions-toolkit";
// import config from "../Functions-request-config";
import { ResponseListener } from "@chainlink/functions-toolkit";
import { BigNumber, Contract } from "ethers";
import { get } from "http";
import { networks } from "../networks";
import { BigBSLStatus, getChainId, getContracts } from "./utils";

async function callStatusRegistryRequestStatus(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = data.subscriptionId;
    const requestTx = await contracts.StatusRegistry.requestStatus(
        contracts.SSIVerifier.address,
        1,
        1,
        true,
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    console.log("Registry requestStatus called");
    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    console.log("Waiting for event");
    const filter = contracts.StatusRegistry.filters.StatusUpdated();
    let events = []
    while (events.length === 0) {
        events = await contracts.StatusRegistry.queryFilter(filter, "latest");

        events.forEach((event) => {
            console.log(event.args);
        });

        if (events.length > 0) {
            const issuanceStatus = await contracts.StatusRegistry.getBSLStatus(1, 1);
            // const revocationStatus = await contracts.StatusRegistry.getBSLStatus(1, 0);
            console.log(`Issuance status: ${issuanceStatus}`);
        }
    }
}

async function callChainlinkConsumerSendRequest(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = data.subscriptionId;
    const source = fs.readFileSync(`${__dirname}/../functions/request-statuses.js`).toString();

    const requestTx = await contracts.ChainlinkConsumer.sendRequest(
        source,
        Location.Remote,
        [],
        ["http://localhost:3000", "0", "0", "1", "0"],
        [],
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    const filter = contracts.ChainlinkConsumer.filters.ResponseReceived();

    let events = []
    while (events.length === 0) {
        events = await contracts.ChainlinkConsumer.queryFilter(filter, "latest");

        events.forEach((event) => {
            console.log(event.args);
        });
    }
}

async function callChainlinkConsumerRequestStatus(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = data.subscriptionId;

    const requestTx = await contracts.ChainlinkConsumer.requestBSLStatus(
        contracts.StatusRegistry.address,
        "http://localhost:3000",
        { time: 0, status: 0 },
        1,
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    const filter = contracts.ChainlinkConsumer.filters.ResponseReceived();

    let events = [];
    while (events.length === 0) {
        events = await contracts.ChainlinkConsumer.queryFilter(filter, "latest");

        events.forEach((event) => {
            console.log(event.args);
        });
    }
}

async function callVerifierRequestStatus(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    const subscriptionId = data.subscriptionId;

    await contracts.SSIVerifier.setSubscriptionId(subscriptionId);
    console.log(`Verifier subscriptionId set to ${await contracts.SSIVerifier.getSubscriptionId()}`);

    // StatusState.IssuerId issuerId,
    // StatusState.StatusType statusType,
    // bool refresh,
    // OracleType oracleType,
    // uint32 callbackGasLimit
    contracts.ChainlinkConsumer.on("ResponseReceived", (args) => {
        console.log("ChainlinkConsumer: ResponseReceived event");
    });
    contracts.SSIVerifier.on("StatusUpdated", async (issuerId, statusType) => {
        console.log("SSIVerifier: Got StatusUpdated event");
        const status = await contracts.SSIVerifier.getBigBSLStatus(issuerId, statusType);
        console.log(status);
    });

    const requestTx = await contracts.SSIVerifier.requestStatus(
        2,
        1,
        false,
        0,
        300_000,
        { gasLimit: 1_750_000 }
    );
    console.log("verifier requestStatus called");
    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // const filter = contracts.SSIVerifier.filters.StatusUpdated();

    // let events = [];
    // while (events.length === 0) {
    //     events = await contracts.SSIVerifier.queryFilter(filter, "latest");

    //     events.forEach((event) => {
    //         console.log(event.args);
    //     });

    //     if (events.length > 0) {
    //         const issuanceStatus = await contracts.SSIVerifier.getBSLStatus(1, 1);
    //         // const revocationStatus = await contracts.StatusRegistry.getBSLStatus(1, 0);
    //         console.log(`Issuance status: ${issuanceStatus}`);
    //     }
    // }
}

async function initContract(contracts: { [key: string]: Contract }, data: { [key: string]: any }) {
    await contracts.SSIVerifier.setSubscriptionId(data.subscriptionId);

    await contracts.StatusRegistry.addIssuer(1, "http://localhost:3000", 0);
    await contracts.StatusRegistry.addIssuer(2, "http://localhost:3000", 2);

    const issuer1 = await contracts.StatusRegistry.getIssuer(1);
    const issuer2 = await contracts.StatusRegistry.getIssuer(2);
    console.log(issuer1);
    console.log(issuer2);
}

async function printBalance(subscriptionId: number) {
    await run("functions-sub-info", { subid: subscriptionId.toString() });
}

function getConsumerDeploymentOverrides(): { gasPrice?: number, nonce?: number } {
    const overrides = {} as { [key: string]: any };

    // If specified, use the gas price from the network config instead of Ethers estimated price
    if (networks[network.name].gasPrice) {
        overrides.gasPrice = networks[network.name].gasPrice;
    }
    // If specified, use the nonce from the network config instead of automatically calculating it
    if (networks[network.name].nonce) {
        overrides.nonce = networks[network.name].nonce;
    }

    // console.log(overrides);
    return overrides;
}

function encodeBigBSLStatus(status: { time: number, data: BigNumber[] }) {
    const encodedData = ethers.utils.defaultAbiCoder.encode(
        ["uint64", "uint256[7]"],
        [status.time, status.data]
    );

    return encodedData;
}

function calculateSampleBigStatus() {
    const initialStatus = BigBSLStatus.generateInitializedStatus(7);
    const encodedStatus = initialStatus.encode();
    const bytes = ethers.utils.arrayify(encodedStatus);
    console.log(encodedStatus);
    console.log(bytes.length);
}

async function testBigBSLStatus() {
    const chainId = await getChainId();
    const contracts = await getContracts(chainId);
    const subscriptionId = await run("functions-sub-create", { amount: "2", contract: contracts.ChainlinkConsumer.address });

    await initContract(contracts, { subscriptionId });

    await callVerifierRequestStatus(contracts, { subscriptionId });
}

async function main() {
    await testBigBSLStatus();

    // const chainId = await getChainId();
    // const contracts = await getContracts(chainId);

    // const subscriptionId = await run("functions-sub-create", { amount: "2", contract: contracts.ChainlinkConsumer.address });

    // await initContract(contracts, { subscriptionId });

    // await run("functions-request", { name: "ChainlinkConsumer", contract: contracts.ChainlinkConsumer.address, subid: subscriptionId.toString(), configpath: `${__dirname}/../Functions-request-config.ts` });


    // // // await callSendRequest(consumerContract, subscriptionId);

    // const beforeInfo = await run("functions-sub-info", { subid: subscriptionId.toString(), log: false });
    // // // await callVerifierRequestStatus(contracts, subscriptionId);
    // // await callChainlinkConsumerSendRequest(contracts, { subscriptionId });
    // // await callChainlinkConsumerRequestStatus(contracts, { subscriptionId });

    // // await callStatusRegistryRequestStatus(contracts, { subscriptionId });
    // await callVerifierRequestStatus(contracts, { subscriptionId });
    // const afterInfo = await run("functions-sub-info", { subid: subscriptionId.toString(), log: false });
    // console.log(`cost: ${beforeInfo.formattedBalance - afterInfo.formattedBalance} LINK`);
}

main();