import fs from "fs";

import { ethers } from "hardhat";
import { Circuit } from "./gnark/gnark";
import { BigNumber, Contract } from "ethers";
import { MTStatus } from "./did/mtStatus";
import { getChainId, getContracts } from "./utils";
import { MTStateTransitionInputs } from "./gnark/mtStateTransitionInputs";
import { get } from "http";
import { generateMTReportsInputs } from "./evaluateCircuit";
// import { deployContracts, writeDeploymentInfo } from "./deploy";

async function setupCircuit(circuitName: string) {
    const circuit = new Circuit(circuitName);
    await circuit.setup();
    await circuit.exportVerifier("../contracts");
}

async function writeDeployment(registryContract: Contract) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const infoPath = `${__dirname}/../../deployments/deployment-info.json`;
    let deploymentInfo = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath).toString()) : {};

    deploymentInfo[chainId] = {
        StatusRegistry: registryContract.address,
    };
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
}

async function generateStatuses(height: number, numStatuses: number, previousStatus: MTStatus) {
    let statuses: MTStatus[] = [];

    statuses.push(previousStatus);
    for (let i = 0; i < numStatuses; i++) {
        const curStatus = await previousStatus.generateNextStatus();
        statuses.push(curStatus);
        previousStatus = curStatus;
    }

    return statuses;
}

async function testSingleStateSubmission(registryContract: Contract, lastStatus: MTStatus) {
    const data2 = await registryContract.getPreviousState(0);
    if (data2[0] != lastStatus.time) {
        console.log(data2[0]);
        throw new Error(`Invalid time: ${data2[0]} != ${lastStatus.time}`);
    }
}

async function submitSingleState(contracts: { [key: string]: Contract }) {
    const registryContract: Contract = contracts.MTStateRegistry;
    const numStatuses = 1;
    const height = 14;
    const data = await registryContract.getPreviousState(0);
    const previousStatus = new MTStatus(height, data[0], MTStatus.getLeavesAtTime(data[0]));
    const statuses = await generateStatuses(height, numStatuses, previousStatus);

    console.log(statuses.length);
    const requestTx = await registryContract.submitSingleState(0, statuses[1].time, statuses[1].merkleTree.calculateRoot(), statuses[1].proof?.generateCalldata());
    const receipt = await requestTx.wait();
    console.log(`Fulfill Single Proof Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function submitMultipleStatesWithProof(contracts: { [key: string]: Contract }) {
    const registryContract: Contract = contracts.MTStateRegistry;
    const numStatuses = 4;
    const height = 11;
    const data = await registryContract.getPreviousState(0);
    const previousStatus = new MTStatus(height, data[0], MTStatus.getLeavesAtTime(data[0]));
    const statuses = await generateStatuses(height, numStatuses, previousStatus);

    const times = statuses.slice(1).map((status) => status.time);
    const roots = statuses.slice(1).map((status) => status.merkleTree.calculateRoot());

    const circuit = new Circuit("MTStateTransition");
    const proof = await circuit.generateProof(MTStateTransitionInputs.readFromList(statuses));

    const proofData = proof.generateCalldata();
    let publicInputs: BigNumber[] = [BigNumber.from(previousStatus.time)];
    for (let i = 0; i < times.length; i++) {
        publicInputs.push(BigNumber.from(times[i]));
    }
    publicInputs.push(statuses[0].merkleTree.calculateRoot());
    for (let i = 0; i < roots.length; i++) {
        publicInputs.push(roots[i]);
    }

    const requestTx = await contracts.MTStateRegistry.submitMultipleStatesWithProof(0, times, roots, proofData);
    const receipt = await requestTx.wait(1);
    console.log(`Fulfill ${numStatuses} Proofs Status Gas used: ${receipt.gasUsed.toString()}`);
}

async function initializeData(contracts: { [key: string]: Contract }) {
    await contracts.MTStateRegistry.initializeState(0);
}

async function testCircuit() {
    const circuit = new Circuit("MTStateTransition");
    // await circuit.setup();
    // await circuit.exportVerifier("../contracts");

    const contracts = await getContracts();

    const factory = await ethers.getContractFactory("MTStateTransitionVerifier");
    const verifier = await factory.deploy();

    await contracts.MTStateRegistry.setMultipleMTVerifier(verifier.address);

    const numStatuses = 5;
    const height = 11;
    const previousStatus = new MTStatus(height, 0, MTStatus.getLeavesAtTime(0));
    const statuses = await generateStatuses(height, numStatuses, previousStatus);

    const circuitInputs = MTStateTransitionInputs.readFromList(statuses);
    const proof = await circuit.generateProof(circuitInputs);
    await circuit.verifyProof(proof, circuitInputs);

    const proofData = proof.generateCalldata();
    const publicInputs = [
        BigNumber.from(statuses[0].time),
        BigNumber.from(statuses[1].time),
        statuses[0].merkleTree.calculateRoot(),
        statuses[1].merkleTree.calculateRoot(),
    ];
    // let publicInputs = [BigNumber.from(1)];
    // for (let i = 0; i < times.length; i++) {
    //     publicInputs.push(BigNumber.from(times[i]));
    // }
    // publicInputs.push(statuses[0].merkleTree.calculateRoot());
    // for (let i = 0; i < roots.length; i++) {
    //     publicInputs.push(roots[i]);
    // }

    console.log(publicInputs.length);
    console.log(publicInputs);

    // await contracts.MTStateTransitionVerifier.verifyProof(proofData, publicInputs);
    await contracts.MTStateRegistry.verifyMultipleStatesProof(proofData, publicInputs);
    // await verifier.verifyProof(proofData, publicInputs);
}


async function testSingleMTCircuit() {
    const circuit = new Circuit("SingleMTStateTransition");
    // await circuit.setup();
    // await circuit.exportVerifier("../contracts");

    const contracts = await getContracts();
    // console.log(contracts);
    // const factory = await ethers.getContractFactory("SingleMTStateTransitionVerifier");
    // const verifier = await factory.deploy();

    // await contracts.MTStateRegistry.setSingleMTVerifier(verifier.address);

    const numStatuses = 1;
    const height = 11;
    const previousStatus = new MTStatus(height, 1, MTStatus.getLeavesAtTime(1));
    const statuses = await generateStatuses(height, numStatuses, previousStatus);

    const circuitInputs = MTStateTransitionInputs.readFromList(statuses);
    const proof = await circuit.generateProof(circuitInputs);
    // await circuit.verifyProof(proof, circuitInputs);

    const proofData = proof.generateCalldata();
    const publicInputs = [
        BigNumber.from(statuses[0].time),
        BigNumber.from(statuses[1].time),
        statuses[0].merkleTree.calculateRoot(),
        statuses[1].merkleTree.calculateRoot(),
    ];
    // let publicInputs = [BigNumber.from(1)];
    // for (let i = 0; i < times.length; i++) {
    //     publicInputs.push(BigNumber.from(times[i]));
    // }
    // publicInputs.push(statuses[0].merkleTree.calculateRoot());
    // for (let i = 0; i < roots.length; i++) {
    //     publicInputs.push(roots[i]);
    // }

    console.log(publicInputs.length);
    console.log(publicInputs);

    // await contracts.SingleMTStateTransitionVerifier.verifyProof(proofData, publicInputs);
    // await verifier.verifyProof(proofData, publicInputs);
    await contracts.MTStateRegistry.verifySingleStateProof(proofData, publicInputs);
}

async function submitMultipleStatesReportWithProof(contracts: { [key: string]: Contract }) {
    const numStatuses = 20;
    const height = 15;
    const numOracles = 8;

    const registryContract: Contract = contracts.MTStateRegistry;
    const previousData = await registryContract.getPreviousState(0);
    const previousStatus = new MTStatus(height, previousData[0], MTStatus.getLeavesAtTime(previousData[0]));

    const circuitInputs = await generateMTReportsInputs(numOracles, height, numStatuses, previousStatus);


    const circuit = new Circuit("AggMTStateReport");
    const proof = await circuit.generateProof(circuitInputs);
    const verification = await circuit.verifyProof(proof, circuitInputs);
    console.log(`Offchain Proof verified: ${verification}`);

    const proofData = proof.generateCalldata();

    const { times, data, indicator } = circuitInputs.generatePublicInputsCalldataForRegistry();
    const oracleIds = Array.from({ length: numOracles }, () => 0);

    // console.log(data);

    const requestTx = await registryContract.submitMultipleStateReport(0, times, data, oracleIds, indicator, proofData);
    const receipt = await requestTx.wait();
    console.log(`Fulfill Report Gas used: ${receipt.gasUsed.toString()}`);
}

async function main() {
    const contracts = await getContracts(await getChainId());

    // await initializeData(contracts);
    // await submitSingleState(contracts);
    // await submitMultipleStatesWithProof(contracts);
    await submitMultipleStatesReportWithProof(contracts);
    // await testCircuit();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });