import { Contract } from "ethers";
import { getContracts, setupCircuits } from "./utils";
import { BigBSLStatus } from "./did/bigBSLStatus";
import { BigStateTransitionInputs } from "./gnark/bigStateTransitionInputs";
import { Circuit } from "./gnark/gnark";
import { generateBSLReportsInputs, generateCBSLReportsInputs } from "./evaluateCircuit";
import { deployContracts } from "./deploy";

async function initializeData(contracts: { [key: string]: Contract }) {
    const tx = await contracts.BSLStateRegistry.initializeState(0);
    tx.wait();
    // await contracts.BSLStateRegistry.registerOracle(0, 1000);
}

async function generateStatuses(numStatuses: number, previousStatus: BigBSLStatus) {
    let statuses: BigBSLStatus[] = [];

    statuses.push(previousStatus);
    for (let i = 0; i < numStatuses; i++) {
        const curStatus = await previousStatus.generateNextStatus();
        statuses.push(curStatus);
        previousStatus = curStatus;
    }

    return statuses;
}

async function submitSingleState(contracts: { [key: string]: Contract }) {
    const registryContract: Contract = contracts.BSLStateRegistry;
    const numStatuses = 1;
    const dataSize = 64;
    const data = await registryContract.getPreviousState(0);
    const previousStatus = new BigBSLStatus(data[0], data[1], dataSize);
    console.log(previousStatus.data);
    const statuses = await generateStatuses(numStatuses, previousStatus);

    console.log(statuses.length);
    console.log(statuses);
    const requestTx = await registryContract.submitSingleState(0, statuses[1].time, statuses[1].data);
    // const requestTx = await registryContract.submitSingleState(0, statuses[1].time, statuses[1].merkleTree.calculateRoot(), statuses[1].proof?.generateCalldata());
    const receipt = await requestTx.wait();
    console.log(`Fulfill Single Proof Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function submitSinglePartState(contracts: { [key: string]: Contract }) {
    const registryContract: Contract = contracts.BSLStateRegistry;
    const numStatuses = 1;
    const dataSize = 128;

    const previousData = await registryContract.getPreviousState(0);
    const previousStatus = new BigBSLStatus(previousData[0], previousData[1], dataSize);


    const circuitInputs = await generateCBSLReportsInputs(1, dataSize, numStatuses, previousStatus);
    // console.log(circuitInputs);
    const time = circuitInputs.finalTransitionTimes[0];
    const index = circuitInputs.finalTransitionIndexes[0];
    const data = circuitInputs.finalTransitionChanges[0];

    const requestTx = await registryContract.submitSinglePartState(0, time, index, data);
    const receipt = await requestTx.wait();
    console.log(`Fulfill Single Part Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function submitMultipleStatesWithProof(contracts: { [key: string]: Contract }) {
    const registryContract: Contract = contracts.BSLStateRegistry;
    const numStatuses = 5;
    const dataSize = 7;
    const data = await registryContract.getPreviousState(0);
    const previousStatus = new BigBSLStatus(data[0], data[1], dataSize);
    console.log(previousStatus.data);
    const statuses = await generateStatuses(numStatuses, previousStatus);
    console.log(statuses);
    const circuitInputs = BigStateTransitionInputs.readFromList(statuses);
    console.log(circuitInputs);

    const circuit = new Circuit("BigStateTransition");
    const proof = await circuit.generateProof(circuitInputs);
    // console.log(proof);
    const proofData = proof.generateCalldata();
    // await circuit.verifyProof(proof, circuitInputs);
    // console.log(statuses.length);
    // console.log(statuses);
    const requestTx = await registryContract.submitMultipleStatesWithProof(0, statuses[statuses.length - 1].time, statuses[statuses.length - 1].data, proofData);
    const receipt = await requestTx.wait();
    console.log(`Fulfill Single Proof Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function submitMultipleStatesReportWithProof(contracts: { [key: string]: Contract }) {
    const numStatuses = 5;
    const dataSize = 128;
    const numOracles = 4;

    const registryContract: Contract = contracts.BSLStateRegistry;
    const previousData = await registryContract.getPreviousState(0);
    const previousStatus = new BigBSLStatus(previousData[0], previousData[1], dataSize);
    const circuitInputs = await generateBSLReportsInputs(numOracles, dataSize, numStatuses, previousStatus);
    console.log(circuitInputs);

    const circuit = new Circuit("AggBSLStateReport");
    const proof = await circuit.generateProof(circuitInputs);

    const verification = await circuit.verifyProof(proof, circuitInputs);
    console.log(`Offchain Proof verified: ${verification}`);

    const proofData = proof.generateCalldata();

    const { time, data, indicator } = circuitInputs.generatePublicInputsCalldataForRegistry();
    const oracleIds = Array.from({ length: numOracles }, () => 0);


    const requestTx = await registryContract.submitMultipleStateReport(0, time, data, oracleIds, indicator, proofData);
    const receipt = await requestTx.wait();
    console.log(`Fulfill Report Gas used: ${receipt.gasUsed.toString()}`);
}

async function submitMultipleStatesChangesReportWithProof(contracts: { [key: string]: Contract }) {
    const numStatuses = 10;
    const dataSize = 7;
    const numOracles = 4;

    const registryContract: Contract = contracts.BSLStateRegistry;
    const previousData = await registryContract.getPreviousState(0);
    const previousStatus = new BigBSLStatus(previousData[0], previousData[1], dataSize);

    const circuitInputs = await generateCBSLReportsInputs(numOracles, dataSize, numStatuses, previousStatus);
    console.log(circuitInputs);

    const circuit = new Circuit("AggCBSLStateReport");
    const proof = await circuit.generateProof(circuitInputs);

    const verification = await circuit.verifyProof(proof, circuitInputs);
    console.log(`Offchain Proof verified: ${verification}`);

    const proofData = proof.generateCalldata();

    const { times, indexes, changes, indicator } = circuitInputs.generatePublicInputsCalldataForRegistry();
    const oracleIds = Array.from({ length: numOracles }, () => 0);

    console.log(times);
    console.log(indexes);
    console.log(changes);

    const requestTx = await registryContract.submitMultipleStateChangesReport(0, times, indexes, changes, oracleIds, indicator, proofData);
    const receipt = await requestTx.wait();
    console.log(`Fulfill Report Gas used: ${receipt.gasUsed.toString()}`);
}


async function main() {
    console.log("Starting evaluation of BSL circuit");
    const contracts = await getContracts();
    // const contracts = await deployBSL();

    // await initializeData(contracts);
    // await submitMultipleStatesReportWithProof(contracts);
    await submitMultipleStatesChangesReportWithProof(contracts);
    // await submitSingleState(contracts);
    // await submitSinglePartState(contracts);
}

// Check if this file is run directly
if (require.main === module) {
    main().then(() => process.exit(0)).catch(error => {
        console.error(error);
        process.exit(1);
    });
}