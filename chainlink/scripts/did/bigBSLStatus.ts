import { ethers } from "hardhat";
import { checkBitAtPosition, set1BitAtPosition } from "../utils";
import { BigNumber, BytesLike } from "ethers";

export class BigBSLStatus {
    time: number;
    data: BigNumber[];
    dataSize: number;

    constructor(time: number, data: BigNumber[], dataSize: number) {
        this.time = time;
        this.data = data;
        this.dataSize = dataSize;
    }

    static decode(encodedData: BytesLike, dataSize: number): BigBSLStatus {
        const decodedData = ethers.utils.defaultAbiCoder.decode(["uint32", `uint256[${dataSize}]`], encodedData);
        return new BigBSLStatus(decodedData[0], decodedData[1], dataSize);
    }

    static generateInitializedStatus(dataSize: number): BigBSLStatus {
        return new BigBSLStatus(0, Array(dataSize).fill(BigNumber.from(0)), dataSize);
    }

    static encodeStatuses(statuses: BigBSLStatus[]) {
        // console.log(`decodedStatus: ${decodedStatus}`);
        const dataSize = statuses[0].dataSize;
        let newStatuses = statuses.map((status) => [ status.time, status.data ]);
        const statusType = `tuple(uint32,uint256[${dataSize}])[]`;
        const encodedStatus = ethers.utils.defaultAbiCoder.encode(
            [statusType],
            [newStatuses]
        );

        return encodedStatus;
    }

    encode(): string {
        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ["uint32", `uint256[${this.dataSize}]`],
            [this.time, this.data]
        );

        return encodedData;
    }

    async findNextChanges(): Promise<{index: number, data: BigNumber, change: BigNumber}> {
        for (let i = 0; i < this.dataSize; i++) {
            let part = this.data[i];

            for (let j = 0; j < 256; j++) {
                if (checkBitAtPosition(part, j) == 0) {
                    return {
                        index: i,
                        data: set1BitAtPosition(part, j),
                        change: set1BitAtPosition(BigNumber.from(0), j),
                    };
                }
            }
        }

        throw new Error("No changes found");
    }

    async generateNextStatus(): Promise<BigBSLStatus> {
        const newTime = this.time + 1;
        let newData = [];

        let isFinished = false;
        for (let i = 0; i < this.dataSize; i++) {
            let part = this.data[i];
            if (!isFinished) {
                for (let j = 0; j < 256; j++) {
                    if (checkBitAtPosition(part, j) == 0) {
                        part = set1BitAtPosition(part, j);
                        isFinished = true;
                        break;
                    }
                }
            }

            newData.push(part);
        }


        return new BigBSLStatus(newTime, newData, this.dataSize);
    }
}