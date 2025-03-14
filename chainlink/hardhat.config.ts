import "@nomicfoundation/hardhat-toolbox";
import "hardhat-contract-sizer";
import "./tasks";

// import "hardhat-circom";
import "@solarity/hardhat-zkit";
import "@solarity/chai-zkit";

import { networks } from "./networks";
import { HardhatUserConfig } from "hardhat/types";
import { version } from "chai";
// const { networks } = require("./networks")

// Enable gas reporting (optional)
const REPORT_GAS = process.env.REPORT_GAS?.toLowerCase() === "true" ? true : false

const SOLC_SETTINGS = {
  optimizer: {
    enabled: true,
    runs: 1_000,
  },
}

const config: HardhatUserConfig = {
  defaultNetwork: "localFunctionsTestnet",
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: SOLC_SETTINGS,
      },
      {
        version: "0.8.19",
        settings: SOLC_SETTINGS,
      },
      {
        version: "0.8.7",
        settings: SOLC_SETTINGS,
      },
      {
        version: "0.7.0",
        settings: SOLC_SETTINGS,
      },
      {
        version: "0.6.11",
        settings: SOLC_SETTINGS,
      },
      {
        version: "0.4.24",
        settings: SOLC_SETTINGS,
      },
    ],
  },
  zkit: {
    compilerVersion: "2.2.0",
    compilationSettings: {
      c: true,
      json: true,
    },
    setupSettings: {
      ptauDownload: false,
    },
    verifiersSettings: {
      verifiersDir: "contracts",
    }
  },
  networks: {
    ...networks,
  },
  etherscan: {
    apiKey: {
      mainnet: networks.ethereum.verifyApiKey,
      avalanche: networks.avalanche.verifyApiKey,
      polygon: networks.polygon.verifyApiKey,
      sepolia: networks.ethereumSepolia.verifyApiKey,
      polygonAmoy: networks.polygonAmoy.verifyApiKey,
      avalancheFujiTestnet: networks.avalancheFuji.verifyApiKey,
      arbitrum: networks.arbitrum.verifyApiKey,
      arbitrumSepolia: networks.arbitrumSepolia.verifyApiKey,
      baseSepolia: networks.baseSepolia.verifyApiKey,
      optimismSepolia: networks.optimismSepolia.verifyApiKey,
      base: networks.base.verifyApiKey,
      optimism: networks.optimism.verifyApiKey,
      celoAlfajores: networks.celoAlfajores.verifyApiKey,
      celo: networks.celo.verifyApiKey,
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia-explorer.base.org",
        },
      },
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api", // https://docs.optimism.etherscan.io/v/optimism-sepolia-etherscan
          browserURL: "https://sepolia-optimistic.etherscan.io/",
        },
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "optimism",
        chainId: 10,
        urls: {
          apiUrl: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io/",
        },
      },
      {
        celoAlfajores: "celoAlfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io",
        },
      },
      {
        celoAlfajores: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://celoscan.io/api",
          browserURL: "https://celoscan.io",
        },
      },
    ],
  },
  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
  contractSizer: {
    runOnCompile: false,
    only: ["FunctionsConsumer", "AutomatedFunctionsConsumer", "FunctionsBillingRegistry"],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },
  mocha: {
    timeout: 200000, // 200 seconds max for running tests
  },
}

export default config;