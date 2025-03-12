import { BigNumber, Contract } from "ethers";
import fs from "fs";
import { ethers } from "hardhat";
import { Circuit } from "./gnark/gnark";

export async function getChainId(): Promise<number> {
    const { chainId } = await ethers.provider.getNetwork();
    console.log(`Chain ID: ${chainId}`);
    return chainId;
}

export function getDeployments(chainId: number): { [key: string]: string } {
    let content = fs.readFileSync(`${__dirname}/../../deployments/deployment-info.json`).toString();
    return JSON.parse(content)[chainId];
}

export async function getContracts(chainId?: number): Promise<{ [key: string]: Contract }> {
    if (!chainId) {
        chainId = await getChainId();
    }

    const deployments = getDeployments(chainId);

    let contracts: { [key: string]: Contract } = {};
    for (const [name, address] of Object.entries(deployments)) {
        const contract = await ethers.getContractAt(name, address);
        contracts[name] = contract;
    }

    return contracts;
}

export function bigNumberToBuffer(bigNumber: BigNumber): Buffer {
    // Convert to a hex string, then remove the "0x" prefix
    const hexString = bigNumber.toHexString().slice(2);
    // Convert the hex string to a Buffer
    return Buffer.from(hexString, "hex");
}

export function checkBitAtPosition(bigNumber: BigNumber, position: number): number {
    // console.log(typeof bigNumber);
    const shiftedValue = bigNumber.shr(position);
    return shiftedValue.and(1).toNumber();
}

export function set1BitAtPosition(bigNumber: BigNumber, position: number): BigNumber {
    return bigNumber.or(BigNumber.from(1).shl(position));
}

export enum ResponseType {
    LastStatus,
    AllStatuses,
    LastStatusWithProof
}

export async function setupCircuit(circuitName: string) {
    const circuit = new Circuit(circuitName);
    await circuit.setup();

    await circuit.exportVerifier("../contracts");
}

export async function setupCircuits(circuitNames: string[]) {
    for (const circuitName of circuitNames) {
        await setupCircuit(circuitName);
    }
}