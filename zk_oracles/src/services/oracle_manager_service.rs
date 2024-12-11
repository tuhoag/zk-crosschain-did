use alloy::{contract::{ContractInstance, Interface}, dyn_abi::DynSolValue, network::EthereumWallet, primitives::{Address, Uint, U256}, providers::{Provider, ProviderBuilder, WsConnect}, rpc::types::{BlockNumberOrTag, Filter}, signers::local::PrivateKeySigner, sol};
use futures_util::StreamExt;
use alloy_sol_types::SolEvent;
use zkcdid_lib_rs::{config::Config, models::{self, oracle::Oracle}};

use crate::{errors::{OracleError, OracleResult}, services::status_exchange_service::StatusExchangeService, utils::solidity::{get_solidity_artifact, get_solidity_contract_address, Artifact}};

use super::status_service::StatusService;

sol!(
    #[allow(missing_docs)]
    #[sol(rpc)]
    #[derive(Debug)]
    ZKOracleManager,
    "../deployments/artifacts/ZKOracleManager.json"
);

pub struct OracleManagerService {
    pub config: Config,
    oracle: Oracle,
    contract_address: Address,
    contract_artifact: Artifact,
    wallet: EthereumWallet,
    // collection: Collection<Oracle>,
}

impl OracleManagerService {
    pub fn new() -> Self {
        let config = Config::load_oracle_config();
        let contract_name = config.get_oracle_manager_contract_name();
        let signer: PrivateKeySigner = config.get_private_key().parse().unwrap();
        let this_oracle = Oracle {
            id: config.get_id(),
            oracle_address: signer.address().to_string(),
            url: format!("http://{}:{}", config.get_oracle_domain(), config.get_server_port()),
            amount: 100,
        };

        // let collection = database.collection(&config.neighbors_collection_name);

        Self {
            config: config.clone(),
            oracle: this_oracle,
            contract_address: get_solidity_contract_address(&config, contract_name).unwrap(),
            contract_artifact: get_solidity_artifact(contract_name).unwrap(),
            wallet: EthereumWallet::from(signer),
            // collection,
        }
    }

    pub async fn get_num_oracles(&self) -> OracleResult<u8> {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_http(self.config.get_solidity_http_rpc_url().parse().unwrap());
        let contract = ContractInstance::new(self.contract_address, provider, Interface::new(self.contract_artifact.abi.clone()));
        Ok(U256::to(&contract.function("getNumOracles", &[])?.call().await.unwrap()[0].as_uint().unwrap().0))
    }

    pub async fn get_oracle(&self, oracle_id: u8) -> OracleResult<Oracle> {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_http(self.config.get_solidity_http_rpc_url().parse().unwrap());
        let contract = ContractInstance::new(self.contract_address, provider, Interface::new(self.contract_artifact.abi.clone()));
        let oracle_id = DynSolValue::Uint(Uint::from(oracle_id), 8);
        let result = contract.function("getOracle", &[oracle_id])?.call().await?;

        // println!("{:?}", result);
        Ok(Oracle::from(result[0].clone()))
    }

    pub async fn add_oracle(&self, oracle: &Oracle) -> OracleResult<()> {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_http(self.config.get_solidity_http_rpc_url().parse().unwrap());
        let contract = ContractInstance::new(self.contract_address, provider, Interface::new(self.contract_artifact.abi.clone()));
        let oracle_id = DynSolValue::Uint(Uint::from(oracle.id), 8);
        // let oracle_address = DynSolValue::Address(Address::from(oracle.oracle_address.clone()));
        let url = DynSolValue::String(oracle.url.clone());
        let amount = DynSolValue::Uint(Uint::from(oracle.amount), 64);

        let _ = contract.function("addOracle", &[oracle_id, url, amount])?.send().await?.with_required_confirmations(self.config.get_confirmations()).watch().await?;
        // println!("{:?}", result);
        Ok(())
    }

    pub async fn add_its_own_oracle(&self) -> OracleResult<()> {
        self.add_oracle(&self.oracle).await
    }

    pub async fn is_this_oracle_registered(&self) -> OracleResult<bool> {
        match self.get_oracle(self.oracle.id).await {
            Ok(oracle) => {
                println!("{:?} == {:?}", oracle, self.oracle);
                Ok(oracle == self.oracle)
            },
            Err(_) => Ok(false),
        }
    }

    pub async fn get_all_onchain_oracles(&self) -> OracleResult<Vec<Oracle>> {
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_http(self.config.get_solidity_http_rpc_url().parse().unwrap());
        let contract = ContractInstance::new(self.contract_address, provider, Interface::new(self.contract_artifact.abi.clone()));
        let result = contract.function("getOracles", &[])?.call().await?;
        let sol_vals = result[0].as_array().unwrap();

        Ok(sol_vals.iter().map(|val| {
            Oracle::from(val.clone())
        }).collect())
    }

    pub fn is_this_oracle_aggregator(&self, request: &ZKOracleManager::Request) -> bool {
        request.aggregatorIds.iter().any(|id| *id == self.oracle.id)
    }

    pub async fn handle_new_request(&self, request: ZKOracleManager::Request) -> OracleResult<()> {
        let status_service = StatusService::new();
        let mut statuses = status_service.get_status_from_api(&request).await?;

        // sort statuses by time
        statuses.sort_unstable_by_key(|status| status.time);
        println!("Sorted Statuses: {:?}", statuses);

        // check the validity of statuses
        let mut pre_status_time = request.lastStatusState.time;
        let mut pre_status_status = request.lastStatusState.status;

        println!("Pre Status status: {:?}", pre_status_status);
        for status in statuses.iter() {
            if status.time < pre_status_time {
                return Err(OracleError::CommonError("Statuses are not sorted by time".into()));
            }

            if (status.status & pre_status_status) != pre_status_status {
                return Err(OracleError::CommonError("Statuses are invalid".to_string()));
            }

            pre_status_time = status.time;
            pre_status_status = status.status;

            println!("Pre Status status: {:?}", pre_status_status);
        }

        self.send_statuses_to_aggregators(&request.aggregatorIds, &statuses).await?;


        // if self.is_this_oracle_aggregator(&request) {
        //     println!("Authorized Request: {:?}", request);
        //     // collect statuses

        //     // send it to aggregator
        // }

        Ok(())
    }

    pub async fn send_statuses_to_aggregators(&self, aggregator_ids: &Vec<u8>, statuses: &Vec<models::status_state::StatusState>) -> OracleResult<()> {
        let service = StatusExchangeService::new();

        // send to all neighbors
        for aggregator_id in aggregator_ids.iter() {
            // if *aggregator_id == self.oracle.id {
            //     continue;
            // }

            let aggregator = self.get_oracle(*aggregator_id).await?;
            println!("Aggregator: {:?}", aggregator);
            service.fulfill_request(&aggregator.url, statuses).await?;
        }


        Ok(())
    }

    pub async fn listen_for_requests(&self) -> OracleResult<()> {
        let ws = WsConnect::new(self.config.get_solidity_ws_rpc_url());
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_ws(ws)
            .await?;

        println!("address: {:?}", self.contract_address);
        let filter = Filter::new()
            .address(self.contract_address)
            .from_block(BlockNumberOrTag::Latest);

        let sub = provider.subscribe_logs(&filter).await?;
        let mut stream = sub.into_stream();

        while let Some(log) = stream.next().await {
            match log.topic0() {
                Some(&ZKOracleManager::RequestReceived::SIGNATURE_HASH) => {
                    let ZKOracleManager::RequestReceived { requestId } = log.log_decode()?.inner.data;
                    // println!("RequestReceived: {:?}", requestId);
                    let mycontract = ZKOracleManager::new(self.contract_address, provider.clone());
                    let request = mycontract.getRequestById(requestId).call().await?._0;
                    self.handle_new_request(request).await?;
                    // println!("Request: {:?}", request);
                },
                _ => {
                    println!("None");
                },
            }
        }

        Ok(())
    }
}