import { BigNumber } from "ethers";
import fs from "fs";
import path from "path";
import { bigNumberToBuffer } from "../utils";


export class MyGroth16Proof {
    a: [BigNumber, BigNumber];
    b: [[BigNumber, BigNumber], [BigNumber, BigNumber]];
    c: [BigNumber, BigNumber];

    constructor(a: [BigNumber, BigNumber], b: [[BigNumber, BigNumber], [BigNumber, BigNumber]], c: [BigNumber, BigNumber]) {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    static fromArray(proofArray: BigNumber[]): MyGroth16Proof {
        return new MyGroth16Proof(
            [proofArray[0], proofArray[1]],
            [[proofArray[2], proofArray[3]], [proofArray[4], proofArray[5]]],
            [proofArray[6], proofArray[7]]);
    }

    static readRawFromFile(path: string): MyGroth16Proof {
        const proofBuffer = fs.readFileSync(path);
        console.log(`Proof length: ${proofBuffer.length}`);
        const fpSize = 4 * 8;
        const a: Buffer[] = [];
        a[0] = proofBuffer.slice(fpSize * 0, fpSize * 1);
        a[1] = proofBuffer.slice(fpSize * 1, fpSize * 2);

        const b: Buffer[][] = [[], []];
        b[0][0] = proofBuffer.slice(fpSize * 2, fpSize * 3);
        b[0][1] = proofBuffer.slice(fpSize * 3, fpSize * 4);
        b[1][0] = proofBuffer.slice(fpSize * 4, fpSize * 5);
        b[1][1] = proofBuffer.slice(fpSize * 5, fpSize * 6);

        const c: Buffer[] = [];
        c[0] = proofBuffer.slice(fpSize * 6, fpSize * 7);
        c[1] = proofBuffer.slice(fpSize * 7, fpSize * 8);

        // console.log(a);
        // console.log(b);
        // console.log(c);

        let result = new MyGroth16Proof(
            [BigNumber.from(a[0]), BigNumber.from(a[1])],
            [[BigNumber.from(b[0][0]), BigNumber.from(b[0][1])], [BigNumber.from(b[1][0]), BigNumber.from(b[1][1])]],
            [BigNumber.from(c[0]), BigNumber.from(c[1])]);

        return result;
    }

    generateCalldata() {
        return [this.a[0], this.a[1], this.b[0][0], this.b[0][1], this.b[1][0], this.b[1][1], this.c[0], this.c[1]];
    }

    writeToFile(filePath: string) {
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const proofBuffer = Buffer.concat([
            bigNumberToBuffer(this.a[0]),
            bigNumberToBuffer(this.a[1]),
            bigNumberToBuffer(this.b[0][0]),
            bigNumberToBuffer(this.b[0][1]),
            bigNumberToBuffer(this.b[1][0]),
            bigNumberToBuffer(this.b[1][1]),
            bigNumberToBuffer(this.c[0]),
            bigNumberToBuffer(this.c[1]),
        ]);

        fs.writeFileSync(filePath, proofBuffer);
    }
}