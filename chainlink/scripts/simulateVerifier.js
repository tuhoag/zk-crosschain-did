const { types } = require("hardhat/config")
const { networks } = require("../networks");
const { ethers } = require("hardhat");
const hre = require("hardhat");



async function main() {
    const networkName = "localFunctionsTestnet";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});