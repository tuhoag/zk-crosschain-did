use alloy::contract::{ContractInstance, Interface};
use alloy::json_abi::JsonAbi;
use alloy::network::{EthereumWallet, TransactionBuilder};
use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder};

use alloy::signers::local::PrivateKeySigner;
use alloy::sol;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use eyre::{Error, Result};
use dotenv;
use futures_util::StreamExt;


const RPC_URL: &str = "http://localhost:8545/";
const SOLIDITY_ARTIFACTS_PATH: &str = "../onchain_solidity/build/artifacts/contracts";

#[derive(Serialize, Deserialize, Debug)]
struct Artifact {
    abi: JsonAbi,
    bytecode: String,
}

type DeploymentInfo = HashMap<u64, HashMap<String, String>>;

async fn get_artifact(contract_name: &str) -> eyre::Result<Artifact> {
    let path = format!("{SOLIDITY_ARTIFACTS_PATH}/{contract_name}.sol/{contract_name}.json");
    println!("{}", path);
    let artifact = std::fs::read_to_string(path)?;
    let artifact: Artifact = serde_json::from_str(&artifact)?;
    Ok(artifact)
}

async fn get_deployment_info() -> eyre::Result<DeploymentInfo> {
    let path = format!("../onchain_solidity/deployment-info.json");
    let deployments = std::fs::read_to_string(path)?;
    let deployments: DeploymentInfo = serde_json::from_str(&deployments)?;
    Ok(deployments)
}

async fn get_contract_address(chain_id: u64, contract_name: &str) -> eyre::Result<Address> {
    let deployments = get_deployment_info().await?;
    if let Some(address) = deployments.get(&chain_id) {
        if let Some(address) = address.get(contract_name) {
            let address = address.parse::<Address>()?;
            Ok(address)
        } else {
            Err(Error::msg("Contract not deployed on this chain"))
        }
    } else {
        Err(Error::msg("Chain ID not found in deployment info"))
    }
}

// async fn get_contract(chain_id: u64, contract_name: &str) -> Result<Contract, Box<dyn std::error::Error>> {
//     let provider = Provider::<Http>::try_from(RPC_URL)?;
//     let provider = Arc::new(provider);
//     let address = get_contract_address(chain_id, contract_name).await?;
//     let artifact = get_artifact(contract_name).await?;
//     let contract = Contract::new(address, artifact.abi, provider);
//     Ok(contract)
// }
sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    #[derive(Debug)]
    ZKOracleManager,
    "../onchain_solidity/build/artifacts/contracts/ZKOracleManager.sol/ZKOracleManager.json"
);

#[tokio::main]
async fn main() -> eyre::Result<()> {
    dotenv::dotenv().ok();

    let chain_id = 1337;
    let contract_name = "ZKOracleManager";

    let pk = std::env::var("PRIVATE_KEY")?;
    let signer: PrivateKeySigner = pk.parse().unwrap();
    let wallet = EthereumWallet::from(signer);


    println!("Wallet address: {:?}", wallet);
    let rpc_url = RPC_URL.parse()?;
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .wallet(wallet)
        .on_http(rpc_url);

    println!("Provider: {:?}", provider);

    // Print the block number.
    let latest_block = provider.get_block_number().await?;
    println!("Latest block number: {latest_block}");

    let contract_address = get_contract_address(chain_id, contract_name).await?;
    // println!("Contract address: {contract_address}");

    // let contract = ZKOracleManager::deploy(&provider).await?;
    // println!("Contract deployed at: {:?}", contract.address());
    let contract = ZKOracleManager::new(contract_address, provider);
    println!("Contract deployed at: {:?}", contract.address());

    let url = "http://localhost:4000";
    let amount = 100;

    let oracle_added_filter = contract.OracleAdded_filter().watch().await?;

    let mut next_oracle_id = contract.numOracles().call().await?._0;
    println!("Next Oracle ID: {:?}", next_oracle_id);

    contract.addOracle(url.to_string(), amount).send().await?.watch().await?;

    // contract.addOracle(url.to_string(), amount).send().await?.watch().await?;
    oracle_added_filter
        .into_stream()
        .for_each(|log| async {
            match log {
                Ok((event, _log)) => {
                    println!("Oracle added: {:?}", event);
                },
                Err(e) => {
                    println!("Error: {:?}", e);
                }
            }
        })
        .await;


    // next_oracle_id = contract.getNextOracleId().call().await?._0;
    // println!("Next Oracle ID: {:?}", next_oracle_id);

    // // let mut builder = contract.addOracle(url.to_string(), amount);
    // // let mut oracle_id = builder.call().await?._0;
    // // println!("Oracle ID: {:?}", oracle_id);

    // let result = contract.getOracle(U256::from(oracle_id)).call().await?._0;
    // // println!("Oracle: {:?}", result.url);
    // // // builder = contract.addOracle(url.to_string(), amount);
    // // oracle_id = builder.call().await?._0;
    // println!("Oracle ID: {:?}", oracle_id);
    // // let tx_hash = builder.send().await?.watch().await?;

    Ok(())
}