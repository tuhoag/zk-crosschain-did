import fs from "fs";
import { BigNumber } from "ethers";
import path from "path";
import { get } from "http";
import { exec, execSync, spawn } from "child_process";
import { bigNumberToBuffer } from "../utils";
import { MyGroth16Proof } from "./proof";

export function getGnarkCircuitPath(): string {
    return path.join(__dirname, "../../circuits-go");
}

export function getCircuitIODir(): string {
    return path.join(getGnarkCircuitPath(), "output");
}

export function executeCommand(dirPath: string, command: string, args: string[]): Promise<string> {
    console.log(`Executing command: ${command} ${args.join(" ")} at ${dirPath}`);
    return new Promise((resolvePromise, rejectPromise) => {
        // Spawn the Go process
        // const child = spawn(command, ["run", goFile, ...args], { cwd: dirPath });
        const child = spawn(command, args, { cwd: dirPath });

        let output = "";
        let errorOutput = "";

        // Capture stdout
        child.stdout.on("data", (data) => {
            console.log(data.toString());
            output += data.toString();
        });

        // Capture stderr
        child.stderr.on("data", (data) => {
            console.error(data.toString());
            errorOutput += data.toString();
        });

        // Handle process close
        child.on("close", (code) => {
            if (code === 0) {
                resolvePromise(output.trim());
            } else {
                rejectPromise(new Error(`Go program exited with code ${code}: ${errorOutput.trim()}`));
            }
        });

        // Handle process errors
        child.on("error", (error) => {
            rejectPromise(new Error(`Failed to start Go program: ${error.message}`));
        });
    });
}

export enum CircuitRunMode {
    Dev = "dev",
    Prod = "prod",
}

export function getCommandAndArgsForMode(mode: CircuitRunMode, args: string[]) {
    let command;
    let commandArgs;
    if (mode == CircuitRunMode.Prod) {
        command = "./zkssi";
        commandArgs = args;
    } else if (mode == CircuitRunMode.Dev) {
        command = "go";
        commandArgs = ["run", "main.go", ...args];
    } else {
        throw new Error(`Invalid mode: ${mode}`);
    }

    return { command, commandArgs };
}

export interface CircuitInputs {
    exportToFile(filePath: string): void;
    generatePublicInputsCalldataForRegistry(): BigNumber[];
}

export class Circuit {
    circuitName: string;
    mode: CircuitRunMode = CircuitRunMode.Dev;

    constructor(circuitName: string) {
        this.circuitName = circuitName;
    }

    async setup() {
        // throw new Error("Method not implemented.");
        const circuitsPath = getGnarkCircuitPath();
        const { command, commandArgs } = getCommandAndArgsForMode(this.mode, ["setup", this.circuitName]);

        try {
            await executeCommand(circuitsPath, command, commandArgs);
            console.log(`Setup successful`);
        } catch (error: any) {
            throw new Error(`Failed to setup circuit: ${error.message}`);
        }
    }

    async executeCommandProveOrVerify(commandName: string, inputs: CircuitInputs) {
        const fileName = "input.json";
        const inputFilePath = path.join(getCircuitIODir(), fileName);
        inputs.exportToFile(inputFilePath);

        const proofFilePath = path.join(getCircuitIODir(), `${fileName}.proof`);

        // Call the Go binary to generate proof
        const circuitsPath = getGnarkCircuitPath();
        // const mainPath = path.join(getGnarkCircuitPath(), "main.go");

        const { command, commandArgs } = getCommandAndArgsForMode(this.mode, [commandName, this.circuitName, inputFilePath, proofFilePath]);

        try {
            await executeCommand(circuitsPath, command, commandArgs);
        } catch (error: any) {
            throw new Error(`Failed to execute ${commandName}: ${error.message}`);
        }
    }

    async generateProof(inputs: CircuitInputs): Promise<MyGroth16Proof> {
        try {
            await this.executeCommandProveOrVerify("prove", inputs);
            const fileName = "input.json";
            const proofFilePath = path.join(getCircuitIODir(), `${fileName}.proof`);

            console.log(`Proof generated at: ${proofFilePath}`);
            return MyGroth16Proof.readRawFromFile(proofFilePath);
        } catch (error: any) {
            throw new Error(`Failed to generate proof: ${error.message}`);
        }
    }

    async verifyProof(proof: MyGroth16Proof, inputs: CircuitInputs): Promise<boolean> {
        const fileName = "input.json";
        const proofFilePath = path.join(getCircuitIODir(), `${fileName}.proof`);
        // proof.writeToFile(proofFilePath);

        try {
            await this.executeCommandProveOrVerify("verify", inputs);
            console.log(`Proof verified`);
            return true;
        } catch (error: any) {
            throw new Error(`Failed to verify proof: ${error.message}`);
        }
    }

    async exportVerifier(outputFilePath: string) {
        const circuitsPath = getGnarkCircuitPath();
        const { command, commandArgs } = getCommandAndArgsForMode(this.mode, ["generate-verifier", this.circuitName, outputFilePath]);

        try {
            await executeCommand(circuitsPath, command, commandArgs);
            console.log(`Export Verifier Contract successful`);
        } catch (error: any) {
            throw new Error(`Failed to export verifier contract: ${error.message}`);
        }
    }
}

