import hre from "hardhat";
import { ethers, network, run } from "hardhat";
import fs from "fs";
import { Location } from "@chainlink/functions-toolkit";
// import config from "../Functions-request-config";
import { ResponseListener } from "@chainlink/functions-toolkit";
import { Contract } from "ethers";

async function callSendRequest(consumerContract: Contract, subscriptionId: number) {
    const source = await consumerContract.getSource();

    const requestTx = await consumerContract.sendRequest(
        source,
        Location.Remote,
        [],
        ["http://localhost:3000", "AAAAAAAAAAA=", "0"],
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
        subscriptionId.toString(),
        300_000,
        { gasLimit: 1_750_000 }
    );
    console.log("requestStatus called");
    await requestTx.wait(1);

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
    await consumerContract.addIssuer(1, "http://localhost:3000");
}

async function main() {
    const consumerContract = await run("functions-deploy-consumer", { name: "StatusRegistry", verify: true });
    const subscriptionId = await run("functions-sub-create", { amount: "2", contract: consumerContract.address });

    await initContract(consumerContract);
    // await callSendRequest(consumerContract, subscriptionId);
    await callRequestStatus(consumerContract, subscriptionId);
}

main()