import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { CircuitInputs } from "./gnark";
import { BigBSLStatus } from "../did/bigBSLStatus";
import { DIDStatus } from "../did/did";
import { BigStateTransitionInputs } from "./bigStateTransitionInputs";
import { set1BitAtPosition } from "../utils";

export class AggCBSLStateTransitionInputs implements CircuitInputs {
    previousState: BigBSLStatus;

    finalTransitionTimes: number[];
    finalTransitionIndexes: number[];
    finalTransitionChanges: BigNumber[];

    reportTimes: number[][];
    reportIndexes: number[][];
    reportChanges: BigNumber[][];

    // finalReport: BigStateTransitionInputs;
    // oracleReports: BigStateTransitionInputs[];
    indicator: BigNumber;
    f: number;

    constructor(f: number, previousState: BigBSLStatus, finalTransitionTimes: number[], finalTransitionIndexes: number[], finalTransitionChanges: BigNumber[], reportTimes: number[][], reportIndexes: number[][], reportChanges: BigNumber[][]) {
        this.f = f;
        this.previousState = previousState;
        this.finalTransitionTimes = finalTransitionTimes;
        this.finalTransitionIndexes = finalTransitionIndexes;
        this.finalTransitionChanges = finalTransitionChanges;
        this.reportTimes = reportTimes;
        this.reportIndexes = reportIndexes;
        this.reportChanges = reportChanges;

        this.indicator = BigNumber.from(0);

        for (let i = 0; i < this.reportTimes.length; i++) {
            this.indicator = set1BitAtPosition(this.indicator, i);
            console.log(`set indicator ${i} ${this.indicator}`);
        }
    }

    static readFromList(newStatuses: BigBSLStatus[]) {
        throw new Error("Method not implemented.");
    }

    exportToFile(filePath: string): void {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let exportData = {
            previousTime: this.previousState.time.toString(),
            previousStatuses: this.previousState.data.map((x) => x.toString()),
            finalTransitionTimes: this.finalTransitionTimes.map((x) => x.toString()),
            finalTransitionIndexes: this.finalTransitionIndexes.map((x) => x.toString()),
            finalTransitionChanges: this.finalTransitionChanges.map((x) => x.toString()),
            reportTimes: this.reportTimes.map((x) => x.map((y) => y.toString())),
            reportIndexes: this.reportIndexes.map((x) => x.map((y) => y.toString())),
            reportChanges: this.reportChanges.map((x) => x.map((y) => y.toString())),
            indicator: this.indicator.toString(),
            f: this.f.toString(),
        };

        const jsonData = JSON.stringify(exportData, null, 2);
        console.log("Writing to file: " + filePath);
        fs.writeFileSync(filePath, jsonData, "utf-8");
    }

    getEncodeTypeOfPublicInputsForRegistry(): string {
        throw new Error("Method not implemented.");
        // return `tuple(uint32 time, uint256[${this.finalTransitionStatus[1].length}] data)`;
    }

    generatePublicInputsCalldataForRegistry(): any {
        // throw new Error("Method not implemented.");
        // uint8[] calldata times,
        // uint16[] calldata indexes,
        // uint256[] calldata changes,
        // uint8[] calldata oracleIds,
        // uint16 indicator,
        return {
            times: this.finalTransitionTimes,
            indexes: this.finalTransitionIndexes,
            changes: this.finalTransitionChanges,
            indicator: this.indicator,
        }
    }
}