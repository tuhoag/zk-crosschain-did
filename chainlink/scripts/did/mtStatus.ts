import { ethers } from "hardhat";
import { checkBitAtPosition, set1BitAtPosition } from "../utils";
import { BigNumber, BytesLike } from "ethers";
import { MerkleTree } from "./merkleTree";
import { additionHash } from "./mimc";
import { Circuit } from "../gnark/gnark";
import { MyGroth16Proof } from "../gnark/proof";
import { MTStateTransitionInputs } from "../gnark/mtStateTransitionInputs";

export class MTStatus {
    time: number;
    merkleTree: MerkleTree;
    proof?: MyGroth16Proof;

    constructor(height: number, time: number, leaves: BigNumber[]) {
        this.time = time;
        this.merkleTree = new MerkleTree(height, leaves, additionHash);
    }

    static getLeavesAtTime(time: number): BigNumber[] {
        let leaves = [];
        for (let i = 1; i <= time; i++) {
            leaves.push(BigNumber.from(i));
        }

        console.log(`Leaves at time ${time}: ${leaves}`);
        return leaves;
    }

    static decode(encodedData: BytesLike): MTStatus {

        const decodedData = ethers.utils.defaultAbiCoder.decode(
            ["uint32", "uint32", "uint256"],
            encodedData
        );
        console.log(`Decoded MTStatus data:`);
        console.log(decodedData);
        let decodedStatus = new MTStatus(decodedData[1], decodedData[0], MTStatus.getLeavesAtTime(decodedData[0]));
        return decodedStatus;
    }

    static generateInitializedStatus(height: number): MTStatus {
        return new MTStatus(height, 0, MTStatus.getLeavesAtTime(0));
    }

    static encodeStatuses(statuses: MTStatus[]) {
        console.log("Oracle: Encoding MTStatuses");
        // console.log(`decodedStatus: ${decodedStatus}`);
        let newStatuses = statuses.map((status) => {
            return {
                time: status.time,
                height: status.merkleTree.height,
                data: status.merkleTree.calculateRoot(),
                proof: status.proof?.generateCalldata()
            }
        });
        console.log(newStatuses);
        const statusType = `tuple(uint32 time, uint32 height, uint256 data, uint256[8] proof)[]`;
        const encodedStatus = ethers.utils.defaultAbiCoder.encode(
            [statusType],
            [newStatuses]
        );

        return encodedStatus;
    }

    encode(): string {
        console.log("Oracle: Encoding MTStatus");
        console.log(this.proof);
        const preparedData = { time: this.time, height: this.merkleTree.height, data: this.merkleTree.calculateRoot(), proof: this.proof?.generateCalldata() };
        console.log(preparedData);
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ["tuple(uint32 time, uint32 height, uint256 data, uint256[8] proof)"],
            [preparedData]
        );

        console.log(`Encoded MTStatus data: ${encodedData}`);
        return encodedData;
    }

    async updateProof(previousStatus: MTStatus) {
        const circuit = new Circuit("SingleMTStateTransition");
        const inputs = MTStateTransitionInputs.readFromList([previousStatus, this]);

        console.log(`Generating proof for time ${this.time}`);
        // console.log(inputs);
        this.proof = await circuit.generateProof(inputs);
    }

    // TransitionTime [2]frontend.Variable `gnark:"transitionTime,public" json:"transitionTime"`
	// TransitionStatus [2]frontend.Variable `gnark:"transitionStatus,public" json:"transitionStatus"`
	// TransitionLeaves [2][NumLeaves]frontend.Variable `gnark:"transitionLeaves" json:"transitionLeaves"`
    async generateNextStatus(): Promise<MTStatus> {
        const newTime = this.time + 1;
        let nextStatus = new MTStatus(this.merkleTree.height, newTime, MTStatus.getLeavesAtTime(newTime));

        // await nextStatus.updateProof(this);
        return nextStatus;
    }
}