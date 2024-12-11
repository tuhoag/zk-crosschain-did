use std::{collections::HashMap, env};
use serde::{Deserialize, Serialize};

use crate::hashmap;

// common
pub const DEFAULT_ID: u8 = 0;

// default api config
pub const DEFAULT_API_PORT: u16 = 8000;

pub const DEFAULT_API_URL: &str = "http://localhost:3000";
pub const DEFAULT_STATUSES_COLLECTION_NAME: &str = "status_states";
pub const DEFAULT_CREDENTIALS_COLLECTION_NAME: &str = "credentials";
pub const DEFAULT_DB_NAME: &str = "api";
pub const DEFAULT_MONGO_URL: &str = "mongodb://localhost:27017";
pub const MAX_TRIAL: u8 = 3;

// default oracle config
pub const DEFAULT_NEIGHBORS_COLLECTION_NAME: &str = "neighbors";
pub const DEFAULT_REQUESTS_COLLECTION_NAME: &str = "requests";
pub const DEFAULT_WAITING_INTERVAL: u64 = 3;
pub const DEFAULT_SOLIDITY_ARTIFACTS_PATH: &str = "../deployments/artifacts";
pub const DEFAULT_SOLIDITY_DEPLOYMENT_PATH: &str = "../deployments/deployment-info.json";
pub const DEFAULT_SOLIDITY_HTTP_RPC_URL: &str = "http://host.docker.internal:8545/";
pub const DEFAULT_SOLIDITY_WS_RPC_URL: &str = "ws://host.docker.internal:8545/";
pub const DEFAULT_CHAIN_ID: u64 = 31337;
pub const DEFAULT_ORACLE_MANAGER_CONTRACT_NAME: &str = "ZKOracleManager";
pub const DEFAULT_CONFIRMATIONS: u64 = 1;
pub const DEFAULT_ORACLE_DOMAIN: &str = "oracle0";
pub const DEFAULT_SERVER_PORT: u16 = 50051;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    data: HashMap<String, String>
}

impl Config {
    pub fn new(data: HashMap<String, String>) -> Self {
        Self { data }
    }

    pub fn load_api_config() -> Self {
        Self::new(hashmap! {
            "API_PORT" => env::var("API_PORT").unwrap_or(DEFAULT_API_PORT.to_string()),
            "API_URL" => env::var("API_URL").unwrap_or(DEFAULT_API_URL.to_string()),
            "STATUSES_COLLECTION_NAME" => env::var("STATUSES_COLLECTION_NAME").unwrap_or(DEFAULT_STATUSES_COLLECTION_NAME.to_string()),
            "CREDENTIALS_COLLECTION_NAME" => env::var("CREDENTIALS_COLLECTION_NAME").unwrap_or(DEFAULT_CREDENTIALS_COLLECTION_NAME.to_string()),
            "DB_NAME" => env::var("DB_NAME").unwrap_or(DEFAULT_DB_NAME.to_string()),
            "MONGO_URL" => env::var("MONGO_URL").unwrap_or(DEFAULT_MONGO_URL.to_string()),
            "MAX_TRIAL" => env::var("MAX_TRIAL").unwrap_or(MAX_TRIAL.to_string()),
            "ID" => env::var("ID").unwrap_or(DEFAULT_ID.to_string()),
            "TYPE" => env::var("TYPE").unwrap_or("api".to_string())
        })
    }


    pub fn load_oracle_config() -> Self {
        Self::new(hashmap!{
            "SERVER_PORT" => env::var("SERVER_PORT").unwrap_or(DEFAULT_SERVER_PORT.to_string()),
            "PRIVATE_KEY" => env::var("PRIVATE_KEY").unwrap(),
            "SOLIDITY_ARTIFACTS_PATH" => env::var("SOLIDITY_ARTIFACTS_PATH").unwrap_or(DEFAULT_SOLIDITY_ARTIFACTS_PATH.to_string()),
            "SOLIDITY_DEPLOYMENT_PATH" => env::var("SOLIDITY_DEPLOYMENT_PATH").unwrap_or(DEFAULT_SOLIDITY_DEPLOYMENT_PATH.to_string()),
            "SOLIDITY_RPC_URL" => env::var("SOLIDITY_RPC_URL").unwrap_or(DEFAULT_SOLIDITY_HTTP_RPC_URL.to_string()),
            "SOLIDITY_WS_RPC_URL" => env::var("SOLIDITY_WS_RPC_URL").unwrap_or(DEFAULT_SOLIDITY_WS_RPC_URL.to_string()),
            "CHAIN_ID" => env::var("CHAIN_ID").unwrap_or(DEFAULT_CHAIN_ID.to_string()),
            "ORACLE_MANAGER_CONTRACT_NAME" => env::var("ORACLE_MANAGER_CONTRACT_NAME").unwrap_or(DEFAULT_ORACLE_MANAGER_CONTRACT_NAME.to_string()),
            "NEIGHBORS_COLLECTION_NAME" => env::var("NEIGHBORS_COLLECTION_NAME").unwrap_or(DEFAULT_NEIGHBORS_COLLECTION_NAME.to_string()),
            "REQUESTS_COLLECTION_NAME" => env::var("REQUESTS_COLLECTION_NAME").unwrap_or(DEFAULT_REQUESTS_COLLECTION_NAME.to_string()),
            "MONGO_URL" => env::var("MONGO_URL").unwrap_or(DEFAULT_MONGO_URL.to_string()),
            "WAITING_INTERVAL" => env::var("WAITING_INTERVAL").unwrap_or(DEFAULT_WAITING_INTERVAL.to_string()),
            "CONFIRMATIONS" => env::var("CONFIRMATIONS").unwrap_or(DEFAULT_CONFIRMATIONS.to_string()),
            "ORACLE_DOMAIN" => env::var("ORACLE_DOMAIN").unwrap_or(DEFAULT_ORACLE_DOMAIN.to_string()),
            "ID" => env::var("ID").unwrap_or(DEFAULT_ID.to_string()),
            "TYPE" => env::var("TYPE").unwrap_or("oracle".to_string())
        })
    }

    pub fn get_db_name(&self) -> String {
        self.get_name()
    }

    pub fn get_mongo_url(&self) -> &str {
        &self.data["MONGO_URL"]
    }

    pub fn get_credentials_collection_name(&self) -> &str {
        &self.data["CREDENTIALS_COLLECTION_NAME"]
    }

    pub fn get_requests_collection_name(&self) -> &str {
        &self.data["REQUESTS_COLLECTION_NAME"]
    }

    pub fn get_api_url(&self) -> &str {
        &self.data["API_URL"]
    }

    pub fn get_type(&self) -> &str {
        &self.data["TYPE"]
    }

    pub fn get_name(&self) -> String {
        format!("{}_{}", self.get_type(), self.get_id())
    }

    pub fn get_api_port(&self) -> u16 {
        self.data["API_PORT"].parse().unwrap()
    }

    pub fn get_statuses_collection_name(&self) -> &str {
        &self.data["STATUSES_COLLECTION_NAME"]
    }

    pub fn get_oracle_manager_contract_name(&self) -> &str {
        &self.data["ORACLE_MANAGER_CONTRACT_NAME"]
    }

    pub fn get_private_key(&self) -> &str {
        &self.data["PRIVATE_KEY"]
    }

    pub fn get_id(&self) -> u8 {
        self.data["ID"].parse().unwrap()
    }

    // pub fn get_server_url(&self) -> &str {
    //     &self.data["SERVER_URL"]
    // }

    pub fn get_server_port(&self) -> &str {
        &self.data["SERVER_PORT"]
    }

    pub fn get_solidity_http_rpc_url(&self) -> &str {
        &self.data["SOLIDITY_RPC_URL"]
    }

    pub fn get_solidity_ws_rpc_url(&self) -> &str {
        &self.data["SOLIDITY_WS_RPC_URL"]
    }

    pub fn get_confirmations(&self) -> u64 {
        self.data["CONFIRMATIONS"].parse().unwrap()
    }

    pub fn get_solidity_artifacts_path(&self) -> &str {
        &self.data["SOLIDITY_ARTIFACTS_PATH"]
    }

    pub fn get_solidity_deployment_path(&self) -> &str {
        &self.data["SOLIDITY_DEPLOYMENT_PATH"]
    }

    pub fn get_chain_id(&self) -> u64 {
        self.data["CHAIN_ID"].parse().unwrap()
    }

    pub fn get_waiting_interval(&self) -> u64 {
        self.data["WAITING_INTERVAL"].parse().unwrap()
    }

    pub fn get_oracle_domain(&self) -> &str {
        &self.data["ORACLE_DOMAIN"]
    }
}