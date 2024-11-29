import process from "process";
import path from "path";
import fs from "fs";
import { startLocalFunctionsTestnet } from "@chainlink/functions-toolkit";
import { utils, Wallet } from "ethers";
import { config } from "@chainlink/env-enc";

// Loads environment variables from .env.enc file (if it exists)
config();

async function main() {
  const requestConfigPath = path.join(process.cwd(), "Functions-request-config.ts");
  console.log(`Using Functions request config file ${requestConfigPath}\n`);

  const localFunctionsTestnetInfo = await startLocalFunctionsTestnet(
    requestConfigPath,
    {
      logging: {
        debug: true,
        verbose: false,
        quiet: false, // Set this to `false` to see logs from the local testnet
      },
    } // Ganache server options (optional)
  );

  console.table({
    "FunctionsRouter Contract Address": localFunctionsTestnetInfo.functionsRouterContract.address,
    "DON ID": localFunctionsTestnetInfo.donId,
    "Mock LINK Token Contract Address": localFunctionsTestnetInfo.linkTokenContract.address,
  });

  // Fund wallets with ETH and LINK
  const addressToFund = new Wallet(process.env["PRIVATE_KEY"] as string).address;
  await localFunctionsTestnetInfo.getFunds(addressToFund, {
    weiAmount: utils.parseEther("100").toString(), // 100 ETH
    juelsAmount: utils.parseEther("100").toString(), // 100 LINK
  });
  if (process.env["SECOND_PRIVATE_KEY"]) {
    const secondAddressToFund = new Wallet(process.env["SECOND_PRIVATE_KEY"]).address;
    await localFunctionsTestnetInfo.getFunds(secondAddressToFund, {
      weiAmount: utils.parseEther("100").toString(), // 100 ETH
      juelsAmount: utils.parseEther("100").toString(), // 100 LINK
    });
  }

  // Update values in networks.js
  for (const fileName of ["networks.js", "networks.ts"]) {
    const configPath = path.join(process.cwd(), fileName);
    let networksConfig = fs.readFileSync(configPath).toString();
    const regex = /localFunctionsTestnet:\s*{\s*([^{}]*)\s*}/s;
    const newContent = `localFunctionsTestnet: {
      url: "http://localhost:8545/",
      accounts,
      confirmations: 1,
      nativeCurrencySymbol: "ETH",
      linkToken: "${localFunctionsTestnetInfo.linkTokenContract.address}",
      functionsRouter: "${localFunctionsTestnetInfo.functionsRouterContract.address}",
      donId: "${localFunctionsTestnetInfo.donId}",
    }`;
    networksConfig = networksConfig.replace(regex, newContent);
    fs.writeFileSync(configPath, networksConfig);
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
