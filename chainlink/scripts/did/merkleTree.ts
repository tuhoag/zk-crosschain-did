import { BigNumber } from "ethers";

type PairHasher = (a: BigNumber, b: BigNumber) => BigNumber;
export class MerkleTree {
    height: number;
    leaves: BigNumber[];
    hasher: any;

    constructor(height: number, leaves: BigNumber[], hasher: PairHasher) {
        this.height = height;
        this.leaves = leaves;

        const numLeaves = 2 ** height;
        for (let i = leaves.length; i < numLeaves; i++) {
            this.leaves.push(BigNumber.from(0));
        }
        this.hasher = hasher;
    }

    calculateRoot(): BigNumber {
        let currentLevel = this.leaves;
        while (currentLevel.length > 1) {
            let nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                let parent = this.hasher(currentLevel[i], currentLevel[i + 1]);
                nextLevel.push(parent);
            }
            currentLevel = nextLevel;
        }

        return currentLevel[0];
    }
}