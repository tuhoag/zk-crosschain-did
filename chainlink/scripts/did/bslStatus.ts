import { BigNumber, BytesLike } from "ethers";
import { ethers } from "hardhat";
import { checkBitAtPosition, set1BitAtPosition } from "../utils";

export class BSLStatus {
    time: number;
    status: BigNumber;

    constructor(time: number, status: BigNumber) {
        this.time = time;
        this.status = status;
    }

    static decode(encodedData: BytesLike): BSLStatus {
        const decodedData = ethers.utils.defaultAbiCoder.decode(
            ["uint64", "uint64"],
            encodedData
        );

        return new BSLStatus(decodedData[0], decodedData[1]);
    }

    encode() {
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ["uint64", "uint64"],
            [this.time, this.status]
        );

        return encodedData;
    }

    static encodeStatuses(statuses: BSLStatus[]) {
        const encodedStatuses = statuses.map((status) => status.encode());
        return ethers.utils.concat(encodedStatuses);
    }

    async generateNextStatus(): Promise<BSLStatus> {
        const newTime = this.time + 1;
        let newData = this.status;

        for (let i = 0; i < 64; i++) {
            if (checkBitAtPosition(newData, i) === 0) {
                newData = set1BitAtPosition(newData, i);
                break;
            }
        }

        return new BSLStatus(newTime, newData);
    }
}