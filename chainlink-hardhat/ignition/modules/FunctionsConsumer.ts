// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import fs from "fs";
import { ethers } from "ethers";

const FunctionsConsumerModule = buildModule("FunctionsConsumer", (m) => {
  const data = fs.readFileSync("functions-testnet-config.json", "utf-8");
  // console.log(data);
  const jsonData = JSON.parse(data);
  // console.log(jsonData);

  const routerAddress = jsonData.functionsRouterContractAddress;
  const donIdBytes32 = ethers.encodeBytes32String(jsonData.donId)
  // console.log(routerAddress);
  const consumer = m.contract("FunctionsConsumer", [routerAddress, donIdBytes32]);

  return { consumer };
});

export default FunctionsConsumerModule;
