import hre from "hardhat";
import { ethers, network, run } from "hardhat";
import fs, { write } from "fs";
import { Location } from "@chainlink/functions-toolkit";
// import config from "../Functions-request-config";
import { ResponseListener } from "@chainlink/functions-toolkit";
import { Contract } from "ethers";
import { get } from "http";
import { zkit } from "hardhat";
import { networks } from "../networks";
import { Circuit } from "./gnark/gnark";
import { info } from "console";

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

async function deployCircuitVerifier(circuitName: string): Promise<Contract> {
    const circuit = new Circuit(circuitName);
    await circuit.exportVerifier("../contracts");

    const verifierContractFactory = await ethers.getContractFactory(`${circuitName}Verifier`);
    const verifierContract = await verifierContractFactory.deploy();
    return verifierContract;
}

async function deployAllContracts(): Promise<{ [key: string]: Contract }> {
    // const statusFactory = await ethers.getContractFactory("StatusState");
    // const library = await statusFactory.deploy();
    // console.log(`Deployed StatusLibrary at ${library.address}`);

    const source = fs.readFileSync(`${__dirname}/../functions/request-big-statuses.js`).toString();
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
    const StatusRegistryContract = await StatusRegistryFactory.deploy(
        chainlinkConsumerContract.address, oracleManagerContract.address
    );
    console.log(`Deployed StatusRegistry at ${StatusRegistryContract.address}`);

    // const stateTransitionVerifierContract = await deployCircuitVerifier("StateTransition");
    // statusRegistryContract.setStateTransitionVerifierAddress(stateTransitionVerifierContract.address);
    // const bigStateTransitionVerifierContract = await deployCircuitVerifier("BigStateTransition");
    const bigStateTransitionVerifierFactory = await ethers.getContractFactory("BigStateTransitionVerifier");
    const BigStateTransitionVerifierContract = await bigStateTransitionVerifierFactory.deploy();
    console.log(`Deployed BigStateTransitionVerifier at ${BigStateTransitionVerifierContract.address}`);
    StatusRegistryContract.setBigStateTransitionVerifierAddress(BigStateTransitionVerifierContract.address);

    const singleMTStateTransitionVerifierFactory = await ethers.getContractFactory("SingleMTStateTransitionVerifier");
    const singleMTStateTransitionVerifierContract = await singleMTStateTransitionVerifierFactory.deploy();
    console.log(`Deployed SingleMTStateTransitionVerifier at ${singleMTStateTransitionVerifierContract.address}`);
    StatusRegistryContract.setSingleMTStateTransitionVerifierAddress(singleMTStateTransitionVerifierContract.address);

    const multiMTStateTransitionVerifierFactory = await ethers.getContractFactory("MTStateTransitionVerifier");
    const multiMTStateTransitionVerifierContract = await multiMTStateTransitionVerifierFactory.deploy();
    console.log(`Deployed MTStateTransitionVerifierFactory at ${multiMTStateTransitionVerifierContract.address}`);
    StatusRegistryContract.setMTStateTransitionVerifierAddress(multiMTStateTransitionVerifierContract.address);

    const ssiVerifierFactory = await ethers.getContractFactory("SSIVerifier");
    const ssiVerifierContract = await ssiVerifierFactory.deploy(
        0,
        StatusRegistryContract.address,
    );
    console.log(`Deployed SSIVerifier at ${ssiVerifierContract.address}`);

    return {
        statusRegistryContract: StatusRegistryContract,
        ssiVerifierContract,
        chainlinkConsumerContract,
        oracleManagerContract,
        // stateTransitionVerifierContract,
    }
}

export async function writeDeploymentInfo(contracts: { [key: string]: Contract }) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const infoPath = `${__dirname}/../../deployments/deployment-info.json`;
    let deploymentInfo = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath).toString()) : {};

    let chainDeploymentInfo: { [key: string]: string } = {};

    for (const [name, contract] of Object.entries(contracts)) {
        chainDeploymentInfo[name] = contract.address;
    }

    deploymentInfo[chainId] = chainDeploymentInfo;

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

async function generateCircuitVerifiers() {
    const circuitNames = ["BigStateTransition"];
    for (const circuitName of circuitNames) {
        const circuit = new Circuit(circuitName);
        await circuit.exportVerifier("../contracts");
    }
}

async function deployContract(contractName: string, args?: any[]): Promise<Contract> {
    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy();
    contract.deployTransaction.wait(2);
    console.log(`Deployed ${contractName} at ${contract.address}`);
    return contract;
}

export async function deployContracts(deploymentInfo: { name: string, args?: [] }[]): Promise<{ [key: string]: Contract }> {
    const contracts: { [key: string]: Contract } = {};

    for (const info of deploymentInfo) {
        const contract = await deployContract(info.name, info.args);
        contracts[info.name] = contract;
    }

    return contracts;
}

async function deployMT() {
    const contracts = await deployContracts([
        { name: "MTStateRegistry" },
        { name: "SingleMTStateTransitionVerifier" },
        { name: "MTStateTransitionVerifier" },
        { name: "AggMTStateReportVerifier" }
    ]);

    await contracts.MTStateRegistry.setSingleMTVerifier(contracts.SingleMTStateTransitionVerifier.address);
    await contracts.MTStateRegistry.setMultipleMTVerifier(contracts.MTStateTransitionVerifier.address);
    await contracts.MTStateRegistry.setMTReportVerifier(contracts.AggMTStateReportVerifier.address);

    const requestTx = await contracts.MTStateRegistry.initializeState(0);
    const receipt = await requestTx.wait();
    console.log(`Initialize State Gas used: ${receipt.gasUsed.toString()}`);

    await contracts.MTStateRegistry.registerOracle(0, 1000);
    await contracts.MTStateRegistry.setFaultTolerance(1);

    return contracts;
}

export async function deployBSL() {
    const contracts = await deployContracts([
        { name: "BSLStateRegistry" },
        { name: "BigStateTransitionVerifier" },
        { name: "AggBSLStateReportVerifier" },
        { name: "AggCBSLStateReportVerifier" },
    ]);

    await contracts.BSLStateRegistry.setBSLVerifier(contracts.BigStateTransitionVerifier.address);
    await contracts.BSLStateRegistry.setBSLReportVerifier(contracts.AggBSLStateReportVerifier.address);
    await contracts.BSLStateRegistry.setBSLStateChangesReportVerifier(contracts.AggCBSLStateReportVerifier.address);

    const requestTx = await contracts.BSLStateRegistry.initializeState(0);
    const receipt = await requestTx.wait();
    console.log(`Initialize State Gas used: ${receipt.gasUsed.toString()}`);

    await contracts.BSLStateRegistry.registerOracle(0, 1000);
    await contracts.BSLStateRegistry.setFaultTolerance(1);

    return contracts;
}

async function main() {
    // run("clean");
    // await setupCircuits(["SingleMTStateTransition", "MTStateTransition"]);

    // run("compile");
    // const contracts = await deployContracts();
    await copyArtifacts();

    // const contracts = await deployMT();
    const contracts = await deployBSL();
    await writeDeploymentInfo(contracts);
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch(error => {
        console.error(error);
        process.exit(1);
    });
}