import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { CircuitInputs } from "./gnark";
import { BigBSLStatus } from "../did/bigBSLStatus";
import { DIDStatus } from "../did/did";

export class BigStateTransitionInputs implements CircuitInputs {
    middleTimes: number[];
    middleStatuses: BigNumber[][];
    transitionTime: number[];
    transitionStatus: BigNumber[][];

    constructor(middleTimes: number[], middleStatuses: BigNumber[][], transitionTime: number[], transitionStatus: BigNumber[][]) {
        this.middleTimes = middleTimes;
        this.middleStatuses = middleStatuses;
        this.transitionTime = transitionTime;
        this.transitionStatus = transitionStatus;
    }

    static readFromRawStatuses(statuses: DIDStatus[]) {
        const newStatuses = statuses as BigBSLStatus[];

        let middleTimes: number[] = [];
        let middleStatuses: BigNumber[][] = [];

        for (let i = 1; i < newStatuses.length - 1; i++) {
            middleTimes.push(newStatuses[i].time);
            middleStatuses.push(newStatuses[i].data);
        }

        const transitionTime = [newStatuses[0].time, newStatuses[newStatuses.length - 1].time];
        const transitionStatus = [newStatuses[0].data, newStatuses[newStatuses.length - 1].data];

        return new BigStateTransitionInputs(middleTimes, middleStatuses, transitionTime, transitionStatus);
    }

    static readFromList(newStatuses: BigBSLStatus[]) {
        let middleTimes: number[] = [];
        let middleStatuses: BigNumber[][] = [];

        for (let i = 1; i < newStatuses.length - 1; i++) {
            middleTimes.push(newStatuses[i].time);
            middleStatuses.push(newStatuses[i].data);
        }

        const transitionTime = [newStatuses[0].time, newStatuses[newStatuses.length - 1].time];
        const transitionStatus = [newStatuses[0].data, newStatuses[newStatuses.length - 1].data];

        return new BigStateTransitionInputs(middleTimes, middleStatuses, transitionTime, transitionStatus);
    }

    exportToFile(filePath: string): void {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const jsonData = JSON.stringify({
            middleTimes: this.middleTimes.map((x) => x.toString()),
            middleStatuses: this.middleStatuses.map((x) => x.map((y) => y.toString())),
            transitionTime: this.transitionTime.map((x) => x.toString()),
            transitionStatus: this.transitionStatus.map((x) => x.map((y) => y.toString())),
        }, null, 2);

        console.log("Writing to file: " + filePath);
        fs.writeFileSync(filePath, jsonData, "utf-8");
    }

    getEncodeTypeOfPublicInputsForRegistry(): string {
        return `tuple(uint32 time, uint256[${this.transitionStatus[1].length}] data)`;
    }

    generatePublicInputsCalldataForRegistry(): any {
        return {
            time: this.transitionTime[1],
            data: this.transitionStatus[1]
        }
    }
}