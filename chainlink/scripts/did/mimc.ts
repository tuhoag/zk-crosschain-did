import { BigNumber } from "ethers";

// Define the BN254 prime field
const PRIME = BigNumber.from("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// MiMC constants
const NUM_ROUNDS = 91; // Standard for BN254

export function bnnAdd(a: BigNumber, b: BigNumber): BigNumber {
    return a.add(b).mod(PRIME);
}

// MiMC hash function
export function mimcHash(x: BigNumber, y: BigNumber, key: BigNumber): BigNumber {
    let t = x.add(y).mod(PRIME); // Combine inputs
    for (let i = 0; i < NUM_ROUNDS; i++) {
        t = t.add(key).mod(PRIME); // t = (t + key) mod PRIME
        t = t.pow(BigNumber.from(7)).mod(PRIME); // t = t^7 mod PRIME
    }
    return t.add(key).mod(PRIME); // Final addition with key
}

function simpleMiMCHash(x: BigNumber, y: BigNumber): BigNumber {
    return mimcHash(x, y, BigNumber.from(0));
}

export function additionHash(x: BigNumber, y: BigNumber): BigNumber {
    return x.add(y).mod(PRIME);
}