import hre from "hardhat";
import { ethers, network, run } from "hardhat";
import fs from "fs";
import { Location } from "@chainlink/functions-toolkit";
// import config from "../Functions-request-config";
import { ResponseListener } from "@chainlink/functions-toolkit";
import { Contract } from "ethers";
import { get } from "http";

async function callSendRequest(consumerContract: Contract, subscriptionId: number) {
    const source = await consumerContract.getSource();

    const requestTx = await consumerContract.sendRequest(
        source,
        Location.Remote,
        [],
        ["http://localhost:3000", "0", "0", "1", "1"],
        [],
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    const requestTxReceipt = await requestTx.wait(1);
    console.log("requestStatus called");
}

async function callRequestStatus(consumerContract: Contract, subscriptionId: number) {
    const requestTx = await consumerContract.requestStatus(
        1,
        1,
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    console.log("requestStatus called");
    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    const filter = consumerContract.filters.ResponseReceived();

    let events = []
    while (events.length === 0) {
        events = await consumerContract.queryFilter(filter, "latest");

        events.forEach((event) => {
            console.log(event.args);
        });
    }
}

async function initContract(consumerContract: Contract) {
    const source = fs.readFileSync(`${__dirname}/../functions/request-statuses.js`).toString();
    await consumerContract.setSource(source);
    await consumerContract.addIssuer(1, "http://localhost:3000", 0);
}

async function printBalance(subscriptionId: number) {
    await run("functions-sub-info", { subid: subscriptionId.toString() });
}

function getConsumerDeploymentOverrides(): { gasPrice?: number, nonce?: number } {
    const overrides = {};

    console.log(hre.networks);

    // If specified, use the gas price from the network config instead of Ethers estimated price
    // if (networks[network.name].gasPrice) {
    //   overrides.gasPrice = networks[network.name].gasPrice
    // }
    // // If specified, use the nonce from the network config instead of automatically calculating it
    // if (networks[network.name].nonce) {
    //   overrides.nonce = networks[network.name].nonce
    // }

    return overrides;
}
async function deployContracts() {
    const StatusLibrary = await ethers.getContractFactory("StatusState");
    const library = await StatusLibrary.deploy();

    console.log(`Deployed StatusLibrary at ${library.address}`);

    // const consumerContract = await consumerContractFactory.deploy(functionsRouter, donIdBytes32, overrides)

    const StatusRegistryContract = await ethers.getContractFactory("StatusRegistry", {
        libraries: {
            StatusState: library.address,
        },
    });

    getConsumerDeploymentOverrides();

    // const statusRegistryContract = await StatusRegistryContract.deploy(functionsRouter, donIdBytes32);
    // console.log(`Deployed StatusRegistry at ${statusRegistryContract.address}`);

    return {

    }
}
async function main() {
    const consumerContract = await deployContracts();

    // const subscriptionId = await run("functions-sub-create", { amount: "2", contract: consumerContract.address });

    // await initContract(consumerContract);
    // // await callSendRequest(consumerContract, subscriptionId);

    // const beforeInfo = await run("functions-sub-info", { subid: subscriptionId.toString() });
    // await callRequestStatus(consumerContract, subscriptionId);
    // const afterInfo = await run("functions-sub-info", { subid: subscriptionId.toString() });
    // console.log(`cost: ${beforeInfo.formattedBalance - afterInfo.formattedBalance} LINK`);
}

main()