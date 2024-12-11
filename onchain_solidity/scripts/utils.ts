import { Contract } from "ethers";
import fs from "fs";
import { ethers } from "hardhat";

export async function getChainId(): Promise<number> {
    const { chainId } = await ethers.provider.getNetwork();
    console.log(`Chain ID: ${chainId}`);
    return chainId;
}

export function getDeployments(chainId: number): { [key: string]: string } {
    let content = fs.readFileSync(`${__dirname}/../../deployments/deployment-info.json`).toString();
    return JSON.parse(content)[chainId];
}

export async function getContracts(chainId: number): Promise<{ [key: string]: Contract }> {
    const deployments = getDeployments(chainId);

    let contracts: { [key: string]: Contract } = {};
    for (const [name, address] of Object.entries(deployments)) {
        const contract = await ethers.getContractAt(name, address);
        contracts[name] = contract;
    }

    return contracts;
}