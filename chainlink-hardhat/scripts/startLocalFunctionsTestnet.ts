import hre from "hardhat";
import fs from "fs";
import { CodeLanguage, startLocalFunctionsTestnet } from "@chainlink/functions-toolkit";
import path from "path";

async function main() {
    const requestConfigPath = path.join(process.cwd(), "../Functions-request-config.js") // @dev Update this to point to your desired request config file

    const localFunctionsTestnetInfo = await startLocalFunctionsTestnet(
        requestConfigPath,
        {
            logging: {
                debug: true,
                verbose: true,
                quiet: true, // Set this to `false` to see logs from the local testnet
            },
        },
        8181, // Ganache server options (optional)
    );

    console.table({
        "FunctionsRouter Contract Address": localFunctionsTestnetInfo.functionsRouterContract.address,
        "DON ID": localFunctionsTestnetInfo.donId,
        "Mock LINK Token Contract Address": localFunctionsTestnetInfo.linkTokenContract.address,
    })

    const config = {
        functionsRouterContractAddress: localFunctionsTestnetInfo.functionsRouterContract.address,
        donId: localFunctionsTestnetInfo.donId,
        linkTokenContractAddress: localFunctionsTestnetInfo.linkTokenContract.address,
    }
    fs.writeFileSync("functions-testnet-config.json", JSON.stringify(config, null, 2), "utf-8");
}

// Boilerplate for handling errors in async main function
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
