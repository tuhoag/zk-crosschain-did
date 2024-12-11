use std::{collections::HashMap, path::Path};

use alloy::{json_abi::JsonAbi, primitives::Address};
use serde::{Deserialize, Serialize};
use zkcdid_lib_rs::config::Config;
// use ZKOracleManager::Oracle;
use crate::errors::{OracleError, OracleResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Artifact {
    pub abi: JsonAbi,
    bytecode: String,
}

pub type SolidityDeployment = HashMap<u64, HashMap<String, String>>;

// sol!(
//     #[allow(missing_docs)]
//     #[sol(rpc)]
//     #[derive(Debug)]
//     ZKOracleManager,
//     "../onchain_solidity/build/artifacts/contracts/ZKOracleManager.sol/ZKOracleManager.json"
// );


pub fn get_solidity_deployment_info(config: &Config) -> OracleResult<SolidityDeployment> {
    let deployments = std::fs::read_to_string(config.get_solidity_deployment_path())?;
    let deployments: SolidityDeployment = serde_json::from_str(&deployments)?;
    Ok(deployments)
}

pub fn get_solidity_artifact(contract_name: &str) -> OracleResult<Artifact> {
    let config = Config::load_oracle_config();
    let path = Path::new(&config.get_solidity_artifacts_path()).join(format!("{contract_name}.json"));
    let artifact_file_content = std::fs::read_to_string(path)?;
    let artifact: Artifact = serde_json::from_str(&artifact_file_content)?;
    Ok(artifact)
}

pub fn get_solidity_contract_address(config: &Config, contract_name: &str) -> OracleResult<Address> {
    let deployments = get_solidity_deployment_info(config)?;

    if let Some(chain_deployments) = deployments.get(&config.get_chain_id()) {
        if let Some(contract_address) = chain_deployments.get(contract_name) {
            let contract_address = contract_address.parse::<Address>()?;
            return Ok(contract_address);
        }
    }

    Err(OracleError::ContractNotDeployedOnChainError(config.get_chain_id(), contract_name.to_string()))
}

// pub fn get_provider(config: &Config) -> OracleResult<Provider<Ethereum>> {
//     let signer: PrivateKeySigner = config.private_key.parse().unwrap();
//     let wallet = EthereumWallet::from(signer);
//     let rpc_url = config.solidity_rpc_url.parse()?;

//     let provider = ProviderBuilder::new()
//         .with_recommended_fillers()
//         .wallet(wallet)
//         .on_http(rpc_url);

//     Ok(provider)
// }

// async fn temp() -> OracleResult<()> {
//     let config = Config::new();

//     let signer: PrivateKeySigner = config.private_key.parse().unwrap();
//     let wallet = EthereumWallet::from(signer);


//     let rpc_url = config.solidity_rpc_url.parse()?;
//     let provider = ProviderBuilder::new()
//         .with_recommended_fillers()
//         .wallet(wallet)
//         .on_http(rpc_url);

//     println!("Provider: {:?}", provider);

//     // Print the block number.
//     let latest_block = provider.get_block_number().await?;
//     println!("Latest block number: {latest_block}");

//     let contract_address = get_contract_address(chain_id, contract_name).await?;
//     // println!("Contract address: {contract_address}");

//     // let contract = ZKOracleManager::deploy(&provider).await?;
//     // println!("Contract deployed at: {:?}", contract.address());
//     let contract = ZKOracleManager::new(contract_address, provider);
//     println!("Contract deployed at: {:?}", contract.address());

//     Ok(())
// }