import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { Circuit, CircuitInputs } from "./gnark";
import { DIDStatus } from "../did/did";
import { MTStatus } from "../did/mtStatus";
import { MyGroth16Proof } from "./proof";

export class MTStateTransitionInputs implements CircuitInputs {
    height: number;
    transitionTime: number[];
    transitionStatus: BigNumber[];
    transitionLeaves: BigNumber[][];
    proofs?: MyGroth16Proof[];

    constructor(height: number, transitionTime: number[], transitionStatus: BigNumber[], transitionLeaves: BigNumber[][]) {
        this.height = height;
        this.transitionTime = transitionTime;
        this.transitionStatus = transitionStatus;
        this.transitionLeaves = transitionLeaves;
    }

    static readFromRawStatuses(statuses: DIDStatus[]) {
        const newStatuses = statuses as MTStatus[];

        let transitionTime = [];
        let transitionStatus = [];
        let transitionLeaves = [];

        for (let i = 0; i < newStatuses.length; i++) {
            transitionTime.push(newStatuses[i].time);
            transitionStatus.push(newStatuses[i].merkleTree.calculateRoot());
            transitionLeaves.push(newStatuses[i].merkleTree.leaves);
        }

        const height = newStatuses[0].merkleTree.height;
        const newStatus = new MTStateTransitionInputs(height, transitionTime, transitionStatus, transitionLeaves);
        return newStatus;
    }

    static readFromList(newStatuses: DIDStatus[]) {
        return MTStateTransitionInputs.readFromRawStatuses(newStatuses);
    }

    exportToFile(filePath: string): void {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // console.log(`MTStateTransitionInputs: ${this.transitionTime}`);
        // const transitionTimes = this.transitionTime.map((x) => x.toString());
        // console.log(transitionTimes);
        const jsonData = JSON.stringify({
            transitionTime: this.transitionTime.map((x) => x.toString()),
            transitionStatus: this.transitionStatus.map((x) => x.toString()),
            transitionLeaves: this.transitionLeaves.map((leaves) => leaves.map((leaf) => leaf.toString())),
        }, null, 2);

        // console.log(jsonData);
        console.log("Writing to file: " + filePath);
        fs.writeFileSync(filePath, jsonData, "utf-8");
    }

    getEncodeTypeOfPublicInputsForRegistry(): string {
        return `tuple(uint32 time, uint32 height, uint256 data, uint256[8] proof)`;
    }

    generatePublicInputsCalldataForRegistry(): any {
        return {
            times: this.transitionTime.slice(1),
            roots: this.transitionStatus.slice(1),
        }
    }
}