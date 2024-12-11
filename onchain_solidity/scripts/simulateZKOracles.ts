import { ethers, network } from "hardhat";
import { Contract } from "ethers";
import fs from "fs";
import { getChainId, getContracts, getDeployments } from "./utils";


async function simulateZKOracles(contracts: { [key: string]: Contract }) {
    // address requesterAddress,
    // string memory url,
    // StatusState.BSLStatus memory lastStatusState,
    // StatusState.StatusType statusType,
    // uint64 subscriptionId,
    // uint32 callbackGasLimit
    console.log(`address: ${contracts.ZKOracleManager.address}`);
    const requestTx = await contracts.ZKOracleManager.requestBSLStatus(
        contracts.StatusRegistry.address,
        "http://api0:8000",
        { time: 0, status: 0 },
        1,
        300_000,
        1_750_000
    );

    const receipt = await requestTx.wait(1);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    const filter = contracts.ZKOracleManager.filters.RequestReceived();
    let events = [];
    while (events.length === 0) {
        events = await contracts.ZKOracleManager.queryFilter(filter, "latest");

        events.forEach((event) => {
            console.log(`Got a request ${event.args}`);
        });

        // if (events.length > 0) {
        //     const issuanceStatus = await contracts.statusRegistryContract.getBSLStatus(1, 1);
        //     console.log(`Issuance status: ${issuanceStatus}`);
        // }
    }
}

async function main() {
    const chainId = await getChainId();
    const contracts = await getContracts(chainId);

    // for (const [name, contract] of Object.entries(contracts)) {
    //     console.log(`${name}: ${contract.address}`);
    // }
    // console.log(contracts.ZKOracleManager);
    await simulateZKOracles(contracts);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});