import fs from "fs";
import path from "path";
import { BigNumber } from "ethers";
import { CircuitInputs } from "./gnark";
import { DIDStatus } from "../did/did";
import { BSLStatus } from "../did/bslStatus";

export class StateTransitionInputs implements CircuitInputs {
    middleTimes: number[];
    middleStatuses: number[];
    transitionTime: number[];
    transitionStatus: number[];

    constructor(middleTimes: number[], middleStatuses: number[], transitionTime: number[], transitionStatus: number[]) {
        this.middleTimes = middleTimes;
        this.middleStatuses = middleStatuses;
        this.transitionTime = transitionTime;
        this.transitionStatus = transitionStatus;
    }

    static readFromRawStatuses(statuses: DIDStatus[]) {
        const newStatuses = statuses as BSLStatus[];
        let middleTimes: number[] = [];
        let middleStatuses: number[] = [];
        for (let i = 1; i < newStatuses.length - 1; i++) {
            middleTimes.push(newStatuses[i].time);
            middleStatuses.push(Number(newStatuses[i].status));
        }

        const transitionTime = [newStatuses[0].time, newStatuses[newStatuses.length - 1].time];
        const transitionStatus = [Number(newStatuses[0].status), Number(newStatuses[newStatuses.length - 1].status)];

        return new StateTransitionInputs(middleTimes, middleStatuses, transitionTime, transitionStatus);
    }

    static readFromList(statuses: BSLStatus[]) {
        let newStatuses: { time: number, decodedStatus: number }[] = [];
        statuses.forEach((status: any) => {
            newStatuses.push({time: status.time, decodedStatus: Number(Buffer.from(status.status, "base64").readBigInt64BE(0))});
        });

        return this.readFromDecodedList(newStatuses);
    }

    static readFromDecodedList(newStatuses: { time: number, decodedStatus: number }[]) {
        let middleTimes: number[] = [];
        let middleStatuses: number[] = [];
        for (let i = 1; i < newStatuses.length - 1; i++) {
            middleTimes.push(newStatuses[i].time);
            middleStatuses.push(newStatuses[i].decodedStatus);
        }

        const transitionTime = [newStatuses[0].time, newStatuses[newStatuses.length - 1].time];
        const transitionStatus = [newStatuses[0].decodedStatus, newStatuses[newStatuses.length - 1].decodedStatus];

        return new StateTransitionInputs(middleTimes, middleStatuses, transitionTime, transitionStatus);
    }

    generatePublicInputsCalldata() {
        return [this.transitionTime[0], this.transitionTime[1], this.transitionStatus[0], this.transitionStatus[1]];
    }

    generatePublicInputsCalldataForRegistry(): any {
        return {
            time: this.transitionTime[1],
            status: this.transitionStatus[1]
        }
    }

    exportToFile(filePath: string) {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const jsonData = JSON.stringify({
            middleTimes: this.middleTimes.map((x) => x.toString()),
            middleStatuses: this.middleStatuses.map((x) => x.toString()),
            transitionTime: this.transitionTime.map((x) => x.toString()),
            transitionStatus: this.transitionStatus.map((x) => x.toString()),
        }, null, 2);

        fs.writeFileSync(filePath, jsonData, "utf-8");
    }
}