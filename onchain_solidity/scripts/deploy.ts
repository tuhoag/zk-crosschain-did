import hre from "hardhat";
import { ethers, network, run } from "hardhat";
import fs, { write } from "fs";
import { Location } from "@chainlink/functions-toolkit";
// import config from "../Functions-request-config";
import { ResponseListener } from "@chainlink/functions-toolkit";
import { Contract } from "ethers";
import { get } from "http";
import { networks } from "../networks";

function getConsumerDeploymentOverrides(): { gasPrice?: number, nonce?: number } {
    const overrides = {} as { [key: string]: any };

    // If specified, use the gas price from the network config instead of Ethers estimated price
    if (networks[network.name].gasPrice) {
        overrides.gasPrice = networks[network.name].gasPrice;
    }
    // If specified, use the nonce from the network config instead of automatically calculating it
    if (networks[network.name].nonce) {
        overrides.nonce = networks[network.name].nonce;
    }

    // console.log(overrides);
    return overrides;
}
async function deployContracts(): Promise<{ [key: string]: Contract }> {
    // const statusFactory = await ethers.getContractFactory("StatusState");
    // const library = await statusFactory.deploy();
    // console.log(`Deployed StatusLibrary at ${library.address}`);

    const source = fs.readFileSync(`${__dirname}/../functions/request-statuses.js`).toString();
    const chainlinkConsumerFactory = await ethers.getContractFactory("ChainlinkConsumer");
    const chainlinkConsumerContract = await chainlinkConsumerFactory.deploy(
        networks[network.name]["functionsRouter"],
        hre.ethers.utils.formatBytes32String(networks[network.name]["donId"]),
        source,
        getConsumerDeploymentOverrides()
    );

    const numAggregators = 1;
    const numAgreements = 1;
    const oracleManagerFactory = await ethers.getContractFactory("ZKOracleManager");
    const oracleManagerContract = await oracleManagerFactory.deploy(numAggregators, numAgreements);
    console.log(`Deployed ZKOracleManager at ${oracleManagerContract.address}`);

    const StatusRegistryFactory = await ethers.getContractFactory("StatusRegistry");
    const statusRegistryContract = await StatusRegistryFactory.deploy(
        chainlinkConsumerContract.address
    );
    console.log(`Deployed StatusRegistry at ${statusRegistryContract.address}`);

    const VerifierFactory = await ethers.getContractFactory("Verifier");
    const verifierContract = await VerifierFactory.deploy(
        0,
        statusRegistryContract.address,
    );
    console.log(`Deployed Verifier at ${verifierContract.address}`);

    return {
        statusRegistryContract,
        verifierContract,
        chainlinkConsumerContract,
        oracleManagerContract,
    }
}

async function writeDeploymentInfo(contracts: { [key: string]: Contract }) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const infoPath = `${__dirname}/../../deployments/deployment-info.json`;
    let deploymentInfo = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath).toString()) : {};

    deploymentInfo[chainId] = {
        StatusRegistry: contracts.statusRegistryContract.address,
        Verifier: contracts.verifierContract.address,
        ChainlinkConsumer: contracts.chainlinkConsumerContract.address,
        ZKOracleManager: contracts.oracleManagerContract.address,
    };
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
}

async function copyArtifacts() {
    const dstDeploymentsPath = `${__dirname}/../../deployments`;
    const dstArtifactsPath = `${dstDeploymentsPath}/artifacts`;
    const srcArtifactsPath = `${__dirname}/../build/artifacts/contracts`;

    if (!fs.existsSync(dstArtifactsPath)) {
        fs.mkdirSync(dstArtifactsPath);
    }

    const artifacts = fs.readdirSync(srcArtifactsPath);
    for (const artifact of artifacts) {
        const name = artifact.split(".")[0];
        const srcPath = `${srcArtifactsPath}/${artifact}/${name}.json`;
        const dstPath = `${dstArtifactsPath}/${name}.json`;
        // console.log(srcPath);
        // console.log(dstPath);
        try {
            fs.copyFileSync(srcPath, dstPath);
        } catch (error) {
            console.warn(`Failed to copy contract ${name}`);
        }

    }
}
async function main() {
    const contracts = await deployContracts();
    await writeDeploymentInfo(contracts);
    // copy artifacts
    await copyArtifacts();
}

main();