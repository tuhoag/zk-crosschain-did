import { Circuit } from "./gnark/gnark";
import { setupCircuit, setupCircuits } from "./utils";

// export async function setupCircuit(circuitName: string) {
//     const circuit = new Circuit(circuitName);
//     await circuit.setup();

//     await circuit.exportVerifier("../contracts");
// }

async function main() {
    // await setupCircuit("BigStateTransition");
    // await setupCircuit("SingleMTStateTransition");
    // await setupCircuit("MTStateTransition");
    await setupCircuits(["AggCBSLStateReport"]);
    // await setupCircuits(["SingleMTStateTransition", "AggMTStateReport"]);
    // await setupCircuits(["AggMTStateReport"]);
}

if (require.main === module) {
    main().then(() => process.exit(0)).catch(error => {
        console.error(error);
        process.exit(1);
    });
}