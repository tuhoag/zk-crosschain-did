import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { CircuitInputs } from "./gnark";
import { BigBSLStatus } from "../did/bigBSLStatus";
import { DIDStatus } from "../did/did";
import { set1BitAtPosition } from "../utils";
import { MTStateTransitionInputs } from "./mtStateTransitionInputs";
import { report } from "process";

export class AggMTStateTransitionInputs implements CircuitInputs {
    finalReport: MTStateTransitionInputs;
    oracleReports: MTStateTransitionInputs[];
    indicator: BigNumber;
    f: number;

    constructor(f: number, finalReport: MTStateTransitionInputs, oracleReports: MTStateTransitionInputs[]) {
        this.f = f;
        this.finalReport = finalReport;
        this.oracleReports = oracleReports;
        this.indicator = BigNumber.from(0);

        for (let i = 0; i < this.oracleReports.length; i++) {
            this.indicator = set1BitAtPosition(this.indicator, i);
        }
    }

    static readFromRawStatuses(reports: DIDStatus[][]) {
        let finalReport = MTStateTransitionInputs.readFromRawStatuses(reports[0]);
        let oracleReports = [];
        for (let i = 0; i < reports.length; i++) {
            oracleReports.push(MTStateTransitionInputs.readFromRawStatuses(reports[i]));
        }

        return new AggMTStateTransitionInputs(1, finalReport, oracleReports);
    }

    static readFromList(newStatuses: BigBSLStatus[]) {
        throw new Error("Method not implemented.");
    }

    exportToFile(filePath: string): void {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // let reportTimes = [];
        // let reportStatuses = [];
        // for (let i = 0; i < this.oracleReports.length; i++) {
        //     let times = this.oracleReports[i].middleTimes.map((x) => x.toString());
        //     times.push(this.oracleReports[i].transitionTime[1].toString());
        //     let statuses = this.oracleReports[i].middleStatuses.map((x) => x.map((y) => y.toString()));
        //     statuses.push(this.oracleReports[i].transitionStatus[1].map((x) => x.toString()));

        //     reportTimes.push(times);
        //     reportStatuses.push(statuses);
        // }

        let exportData = {
            finalTransitionTime: this.finalReport.transitionTime.map((x) => x.toString()),
            finalTransitionStatus: this.finalReport.transitionStatus.map((x) => x.toString()),
            finalTransitionLeaves: this.finalReport.transitionLeaves.map((x) => x.map((y) => y.toString())),
            reportTransitionTime: this.oracleReports.map((x) => x.transitionTime.map((y) => y.toString())),
            reportTransitionStatus: this.oracleReports.map((x) => x.transitionStatus.map((y) => y.toString())),
            reportTransitionLeaves: this.oracleReports.map((x) => x.transitionLeaves.map((y) => y.map((z) => z.toString()))),
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

        return {
            times: this.finalReport.transitionTime.slice(1),
            data: this.finalReport.transitionStatus.slice(1),
            indicator: this.indicator,
        }
    }
}