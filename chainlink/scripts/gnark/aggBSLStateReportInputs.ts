import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { CircuitInputs } from "./gnark";
import { BigBSLStatus } from "../did/bigBSLStatus";
import { DIDStatus } from "../did/did";
import { BigStateTransitionInputs } from "./bigStateTransitionInputs";
import { set1BitAtPosition } from "../utils";

export class AggBSLStateTransitionInputs implements CircuitInputs {
    finalReport: BigStateTransitionInputs;
    oracleReports: BigStateTransitionInputs[];
    indicator: BigNumber;
    f: number;

    constructor(f: number, finalReport: BigStateTransitionInputs, oracleReports: BigStateTransitionInputs[]) {
        this.f = f;
        this.finalReport = finalReport;
        this.oracleReports = oracleReports;
        this.indicator = BigNumber.from(0);

        for (let i = 0; i < this.oracleReports.length; i++) {
            this.indicator = set1BitAtPosition(this.indicator, i);
            console.log(`set indicator ${i} ${this.indicator}`);
        }
    }

    static readFromRawStatuses(reports: DIDStatus[][]) {
        let finalReport = BigStateTransitionInputs.readFromRawStatuses(reports[0]);
        let oracleReports = [];
        for (let i = 0; i < reports.length; i++) {
            oracleReports.push(BigStateTransitionInputs.readFromRawStatuses(reports[i]));
        }

        return new AggBSLStateTransitionInputs(1, finalReport, oracleReports);
    }

    static readFromList(newStatuses: BigBSLStatus[]) {
        throw new Error("Method not implemented.");
    }

    exportToFile(filePath: string): void {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let reportTimes = [];
        let reportStatuses = [];
        for (let i = 0; i < this.oracleReports.length; i++) {
            let times = this.oracleReports[i].middleTimes.map((x) => x.toString());
            times.push(this.oracleReports[i].transitionTime[1].toString());
            let statuses = this.oracleReports[i].middleStatuses.map((x) => x.map((y) => y.toString()));
            statuses.push(this.oracleReports[i].transitionStatus[1].map((x) => x.toString()));

            reportTimes.push(times);
            reportStatuses.push(statuses);
        }

        let exportData = {
            finalMiddleTimes: this.finalReport.middleTimes.map((x) => x.toString()),
            finalMiddleStatuses: this.finalReport.middleStatuses.map((x) => x.map((y) => y.toString())),
            finalTransitionTime: this.finalReport.transitionTime.map((x) => x.toString()),
            finalTransitionStatus: this.finalReport.transitionStatus.map((x) => x.map((y) => y.toString())),
            reportTimes: reportTimes,
            reportStatuses: reportStatuses,
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
        // uint8 issuerId,
        // uint8 time,
        // uint256[DATA_SIZE] calldata data,
        // uint8[] calldata oracleIds,
        // uint8 indicator,
        // uint256[8] calldata proof
        return {
            time: this.finalReport.transitionTime[1],
            data: this.finalReport.transitionStatus[1],
            indicator: this.indicator,
        }
    }
}