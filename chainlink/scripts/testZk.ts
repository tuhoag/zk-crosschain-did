import { zkit, ethers } from "hardhat";
import { expect } from "chai";
import path from "path";
import fs from "fs";

import { getChainId, getContracts } from "./utils";
import { Circuit, CircuitRunMode } from "./gnark/gnark";
import { stat } from "fs";
import { BigNumber } from "ethers";
import { StateTransitionInputs } from "./gnark/stateTransitionInputs";
import { BigBSLStatus } from "./did/bigBSLStatus";
import { BigStateTransitionInputs } from "./gnark/bigStateTransitionInputs";
import { multiMiMC7 } from "mimc-hasher";
import { additionHash, bnnAdd, mimcHash } from "./did/mimc";
import BN from "bn.js";
import { MerkleTree } from "./did/merkleTree";
import { MTStatus } from "./did/mtStatus";
import { MTStateTransitionInputs } from "./gnark/mtStateTransitionInputs";


async function testStateTransition() {
    const circuit = await zkit.getCircuit("StateTransition");

    console.log("Generating proof...");
    const output = await circuit.generateProof({ times: ["1", "2", "3"], statuses: ["0", "1", "3"] });
    console.log(`Proof generation result: ${JSON.stringify(output)}`);

    console.log("Verifying proof...");
    // const verificationResult = await circuit.verifyProof(output);
    // console.log(`Offchain verification result: ${verificationResult}`);
    // console.log(typeof verificationResult);
    const chainId = await getChainId();
    const contracts = await getContracts(chainId);
    const callData = await circuit.generateCalldata(output);
    console.log("CallData");
    console.log(callData);
    const onchainVerificationResult = await contracts.StateTransitionGroth16Verifier.verifyProof(...callData);
    console.log(`Onchain verification result: ${onchainVerificationResult}`);
}


async function testOffchainGnark() {
    const contracts = await getContracts(await getChainId());
    const verifierContract = contracts.StateTransitionGnarkVerifier;

    const numStatuses = 5;
    let statuses = [{ time: 0, decodedStatus: 0 }];

    for (let i = 1; i <= numStatuses; i++) {
        statuses.push({
            time: i,
            decodedStatus: statuses[i - 1].decodedStatus | (1 << (i - 1))
        });
    }

    const inputs = StateTransitionInputs.readFromDecodedList(statuses);
    console.log(inputs);
    // const inputs = new StateTransitionInputs([2], [1], [1, 3], [0, 3]);
    const circuit = new Circuit("StateTransition");
    // circuit.mode = CircuitRunMode.Prod;
    const proof = await circuit.generateProof(inputs);

    const proofCalldata = proof.generateCalldata();
    const publicInputsCalldata = inputs.generatePublicInputsCalldata();
    // console.log(proofCalldata);
    // console.log(publicInputsCalldata);

    const verification = await circuit.verifyProof(proof, inputs);
    console.log(`Offchain Proof verified: ${verification}`);

    try{
        await verifierContract.verifyProof(proofCalldata, publicInputsCalldata);
        console.log("Onchain Proof verified successfully");
    } catch (error) {
        console.error(`Failed to verify: ${error}`);
    }


}

function flatten(array: any): number[] {
    return Array.isArray(array) ? array.flatMap((array) => flatten(array)) : array;
  }


function testBigNumber() {
    let bigNumber = BigNumber.from(1);
    console.log(bigNumber.toString());

    const shifted1Bit = bigNumber.shl(1);
    console.log(shifted1Bit.toString());

    const shifted2Bits = bigNumber.shl(2);
    console.log(shifted2Bits.toString());

    console.log(shifted2Bits.shr(1).eq(shifted1Bit));

    const pos0 = shifted2Bits.shr(0).and(1);
    const pos1 = shifted2Bits.shr(1).and(1);
    const pos2 = shifted2Bits.shr(2).and(1);

    console.log(pos0.toString());
    console.log(pos1.toString());
    console.log(pos2.toString());

    const setBit4Number = bigNumber.or(BigNumber.from(1).shl(4));
    console.log(setBit4Number.toString());
    console.log(setBit4Number.shr(4).and(1).toString());
}

async function testBigCircuit() {
    const numStatuses = 4;
    const dataSize = 7;
    const firstStatus = BigBSLStatus.generateInitializedStatus(dataSize);

    let statuses = [firstStatus];

    for (let i = 1; i < numStatuses; i++) {
        statuses.push(await statuses[i - 1].generateNextStatus());
    }

    const inputs = BigStateTransitionInputs.readFromRawStatuses(statuses);
    // console.log(inputs);
    // const inputs = new StateTransitionInputs([2], [1], [1, 3], [0, 3]);
    const circuit = new Circuit("BigStateTransition");
    await circuit.setup();
    // circuit.mode = CircuitRunMode.Prod;
    const proof = await circuit.generateProof(inputs);

    // const proofCalldata = proof.generateCalldata();
    // const publicInputsCalldata = inputs.generatePublicInputsCalldata();
    // console.log(proofCalldata);
    // console.log(publicInputsCalldata);

    const verification = await circuit.verifyProof(proof, inputs);
    console.log(`Offchain Proof verified: ${verification}`);
}


// type MTStateTransition struct {
// 	TransitionTime [2]frontend.Variable `gnark:"transitionTime,public" json:"transitionTime"`
// 	TransitionStatus [2]frontend.Variable `gnark:"transitionStatus,public" json:"transitionStatus"`
// 	MiddleTimes [NumMiddleMTStatuses]frontend.Variable `gnark:"middleTimes" json:"middleTimes"`
// 	MiddleStatuses [NumMiddleMTStatuses]frontend.Variable `gnark:"middleStatuses" json:"middleStatuses"`

// 	TransitionLeaves [2][NumLeaves]frontend.Variable `gnark:"transitionLeaves" json:"transitionLeaves"`
// 	MiddleLeaves [NumMiddleMTStatuses][NumLeaves]frontend.Variable `gnark:"middleLeaves" json:"middleLeaves"`
// }

async function testMerkleTreeCircuit() {
    const height = 2;
    const numStatuses = 3;

    const firstStatus = MTStatus.generateInitializedStatus(height);

    let statuses = [firstStatus];
    for (let i = 1; i <= numStatuses; i++) {
        statuses.push(await statuses[i - 1].generateNextStatus());
    }

    console.log(statuses.length);
    console.log(statuses);
    const inputs = MTStateTransitionInputs.readFromRawStatuses(statuses);
    inputs.exportToFile(path.join(__dirname, "../circuits-go/output", "input.json"));

    const circuit = new Circuit("MTStateTransition");
    await circuit.setup();
    const proof = await circuit.generateProof(inputs);

    // const inputs = {
    //     transitionTime: [firstStatus.time, firstStatus.time + numStatuses],
    //     transitionStatus: [firstStatus.merkleTree.calculateRoot(), firstStatus.generateNextStatus().merkleTree.calculateRoot()],
    //     leaves: leaves.map((leaf) => leaf.toString()),
    //     rootHash: root.toString()
    // }
    // console.log(inputs);

    // const jsonData = JSON.stringify(inputs, null, 2);
    // const filePath = path.join(__dirname, "../circuits-go/output", "input.json");
    // console.log("Writing to file: " + filePath);
    // fs.writeFileSync(filePath, jsonData, "utf-8");

    // const circuit = new Circuit("MTTransition");
    // await circuit.setup();

    // const proof = await circuit.generateProof(inputs);



    // let tree = new MerkleTree([BigNumber.from(1), BigNumber.from(2), BigNumber.from(3), BigNumber.from(4)], multiMiMC7);
}

async function main() {
    // await testMultiplier();
    // await testStateTransition();
    // await testOffchainGnark();
    // testBigNumber();
    await testBigCircuit();

    // await testMerkleTreeCircuit();
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });