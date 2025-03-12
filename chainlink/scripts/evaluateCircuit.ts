import { stat } from "fs";
import { ZKOracleManager } from "../typechain-types";
import { BigBSLStatus } from "./did/bigBSLStatus";
import { BSLStatus } from "./did/bslStatus";
import { DIDStatus } from "./did/did";
import { MTStatus } from "./did/mtStatus";
import { AggBSLStateTransitionInputs } from "./gnark/aggBSLStateReportInputs";
import { BigStateTransitionInputs } from "./gnark/bigStateTransitionInputs";
import { Circuit, CircuitRunMode } from "./gnark/gnark";
import { MTStateTransitionInputs } from "./gnark/mtStateTransitionInputs";
import { getChainId, getContracts } from "./utils";
import { AggMTStateTransitionInputs } from "./gnark/aggMTStateReportInputs";
import { AggCBSLStateTransitionInputs } from "./gnark/aggCBSLStateReportInputs";

async function generateStatuses(previousStatus: DIDStatus, numStatuses: number) {
    let statuses: DIDStatus[] = [];
    // let previousStatus = BigBSLStatus.generateInitializedStatus(dataSize);

    statuses.push(previousStatus);
    for (let i = 0; i < numStatuses; i++) {
        const curStatus = await previousStatus.generateNextStatus();
        statuses.push(curStatus);
        previousStatus = curStatus;
    }

    // console.log(statuses.map((status) => status.time));
    // console.log(statuses.length);

    return statuses;
}

async function evaluateBSL(circuitName: string) {
    const numStatuses = 5;
    const dataSize = 7;
    const firstStatus = BigBSLStatus.generateInitializedStatus(dataSize);
    const circuit = new Circuit(circuitName);
    const statuses = await generateStatuses(firstStatus, numStatuses);
    const inputs = BigStateTransitionInputs.readFromRawStatuses(statuses);
    // circuit.mode = CircuitRunMode.Prod;

    try {
        await circuit.setup();
        const proof = await circuit.generateProof(inputs);
        const verification = await circuit.verifyProof(proof, inputs);
        console.log(`Offchain Proof verified: ${verification}`);
    } catch (e) {
        console.error(e);
    }
}

async function generateReports(numOracles: number, statuses: DIDStatus[]) {
    let reports = [];
    for (let i = 0; i < numOracles; i++) {
        reports.push(statuses);
    }

    return reports;
}

function duplicateArray(numOracles: number, statuses: any[]) {
    let reports = [];
    for (let i = 0; i < numOracles; i++) {
        reports.push(statuses);
    }

    return reports;
}

export async function generateBSLReportsInputs(numOracles: number, dataSize: number, numStatuses: number, firstStatus?: DIDStatus) {
    let previousState: BigBSLStatus;
    if (!firstStatus) {
        previousState = BigBSLStatus.generateInitializedStatus(dataSize);
    } else {
        previousState = firstStatus as BigBSLStatus;
    }
    // const firstStatus = BigBSLStatus.generateInitializedStatus(dataSize);
    const statuses = await generateStatuses(previousState, numStatuses);
    const reports = await generateReports(numOracles, statuses);
    const inputs = AggBSLStateTransitionInputs.readFromRawStatuses(reports);

    return inputs;
}

async function generateStatusChanges(previousState: BigBSLStatus, numStatuses: number) {
    let finalTransitionTimes = [];
    let finalTransitionIndexes = [];
    let finalTransitionStatuses = [];
    let finalTransitionChanges = [];

    let curState = previousState;
    for (let i = 0; i < numStatuses; i++) {
        const { index, data, change } = await curState.findNextChanges();
        finalTransitionTimes.push(previousState.time + i + 1);
        finalTransitionIndexes.push(index);
        finalTransitionStatuses.push(data);
        finalTransitionChanges.push(change);

        // console.log(`i:${i}: ${data} - ${change}`);

        curState = new BigBSLStatus(previousState.time + i + 1, curState.data.map((x, idx) => idx === index ? data : x), previousState.dataSize);
    }


    return { finalTransitionTimes, finalTransitionIndexes, finalTransitionStatuses, finalTransitionChanges };
}

export async function generateCBSLReportsInputs(numOracles: number, dataSize: number, numStatuses: number, firstStatus?: DIDStatus) {
    let previousState: BigBSLStatus;
    if (!firstStatus) {
        previousState = BigBSLStatus.generateInitializedStatus(dataSize);
    } else {
        previousState = firstStatus as BigBSLStatus;
    }

    // const firstStatus = BigBSLStatus.generateInitializedStatus(dataSize);

    const { finalTransitionTimes, finalTransitionIndexes, finalTransitionStatuses, finalTransitionChanges } = await generateStatusChanges(previousState, numStatuses);
    const inputs = new AggCBSLStateTransitionInputs(
        1,
        previousState,
        finalTransitionTimes,
        finalTransitionIndexes,
        finalTransitionChanges,
        duplicateArray(numOracles, finalTransitionTimes),
        duplicateArray(numOracles, finalTransitionIndexes),
        duplicateArray(numOracles, finalTransitionChanges),
    );

    return inputs;
}

export async function generateMTReportsInputs(numOracles: number, height: number, numStatuses: number, firstStatus?: DIDStatus) {
    let previousState: MTStatus;
    if (!firstStatus) {
        previousState = MTStatus.generateInitializedStatus(height);
    } else {
        previousState = firstStatus as MTStatus;
    }
    // const firstStatus = BigBSLStatus.generateInitializedStatus(dataSize);
    const statuses = await generateStatuses(previousState, numStatuses);
    const reports = await generateReports(numOracles, statuses);
    const inputs = AggMTStateTransitionInputs.readFromRawStatuses(reports);

    return inputs;
}

async function evaluateAggBSL(circuitName: string) {
    const numStatuses = 5;
    const dataSize = 8;
    const numOracles = 3;
    const f = 1;
    const inputs = await generateBSLReportsInputs(numOracles, dataSize, numStatuses);

    // console.log(reports);
    // console.log(inputs);
    let circuit = new Circuit(circuitName);
    // circuit.mode = CircuitRunMode.Prod;

    try {
        await circuit.setup();
        const proof = await circuit.generateProof(inputs);
        const verification = await circuit.verifyProof(proof, inputs);
        console.log(`Offchain Proof verified: ${verification}`);
    } catch (e) {
        console.error(e);
    }
}

async function evaluateAggCBSL(circuitName: string) {
    const numStatuses = 5;
    const dataSize = 32;
    const numOracles = 4;
    const f = 1;
    const inputs = await generateCBSLReportsInputs(numOracles, dataSize, numStatuses);

    // console.log(reports);
    // console.log(inputs);
    let circuit = new Circuit(circuitName);
    // circuit.mode = CircuitRunMode.Prod;

    try {
        await circuit.setup();
        const proof = await circuit.generateProof(inputs);
        // const verification = await circuit.verifyProof(proof, inputs);
        // console.log(`Offchain Proof verified: ${verification}`);
    } catch (e) {
        console.error(e);
    }
}

async function evaluateMT(circuitName: string) {
    const numStatuses = 5;
    const height = 11;
    const firstStatus = MTStatus.generateInitializedStatus(height);
    const circuit = new Circuit(circuitName);
    const statuses = await generateStatuses(firstStatus, numStatuses);
    const inputs = MTStateTransitionInputs.readFromRawStatuses(statuses);
    // circuit.mode = CircuitRunMode.Prod;

    // console.log(inputs);
    try {
        await circuit.setup();
        const proof = await circuit.generateProof(inputs);
        const verification = await circuit.verifyProof(proof, inputs);
        console.log(`Offchain Proof verified: ${verification}`);
    } catch (e) {
        console.error(e);
    }
}

async function evaluateAggMT(circuitName: string) {
    const numStatuses = 5;
    const height = 15;
    const numOracles = 4;

    const firstStatus = MTStatus.generateInitializedStatus(height);
    console.log(firstStatus);
    const circuit = new Circuit(circuitName);

    const inputs = await generateMTReportsInputs(numOracles, height, numStatuses, firstStatus);

    console.log(inputs);
    // circuit.mode = CircuitRunMode.Prod;

    // try {
    //     await circuit.setup();
    //     const proof = await circuit.generateProof(inputs);
    //     const verification = await circuit.verifyProof(proof, inputs);
    //     console.log(`Offchain Proof verified: ${verification}`);
    // } catch (e) {
    //     console.error(e);
    // }
}

async function main() {
    // await evaluateBSL("BigStateTransition");
    // await evaluateMT("MTStateTransition");
    // await evaluateAggBSL("AggBSLStateReport");
    // await evaluateAggMT("AggMTStateReport");
    await evaluateAggCBSL("AggCBSLStateReport");
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch(error => {
        console.error(error);
        process.exit(1);
    });
}