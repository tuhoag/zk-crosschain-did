use alloy::{contract::{ContractInstance, Interface}, dyn_abi::{DynSolError, DynSolType, DynSolValue}, hex::{self, encode}, network::EthereumWallet, primitives::{address, Address, FixedBytes, Uint, U256, U64, Bytes}, providers::{Provider, ProviderBuilder, WsConnect}, rpc::types::{request, BlockNumberOrTag, Filter}, signers::local::PrivateKeySigner};
// use alloy::primitives::{fixed_bytes, b256, Bytes};
use futures_util::StreamExt;
use alloy_sol_types::{SolEvent};
use zkcdid_lib_rs::{config::Config, contracts::ZKOracleManager, models::{oracle::Oracle, oracle_request::OracleRequest, request_report::RequestReport, status_state::StatusMechanism}, utils::db};

use crate::{errors::{OracleError, OracleResult}, services::{oracle_request_service::OracleRequestService, request_report_service::RequestReportService, status_exchange_service::StatusExchangeService}, utils::solidity::{get_solidity_artifact, get_solidity_contract_address, Artifact}};

use super::status_service::StatusService;

pub struct OracleManagerService {
    pub config: Config,
    oracle: Oracle,
    pub contract_address: Address,
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

    pub fn is_this_oracle_aggregator(&self, request: &OracleRequest) -> bool {
        request.aggregator_ids.iter().any(|id| *id == self.oracle.id)
    }

    pub async fn handle_new_request(&self, request: &OracleRequest) -> OracleResult<()> {
        let is_aggregator = self.is_this_oracle_aggregator(&request);
        let database = db::get_db(&self.config).await?;
        let request_service = OracleRequestService::new(&database);

        // if is_aggregator {
        request_service.insert_one(&request).await?;
        // }

        let status_service = StatusService::new();
        let mut statuses = status_service.get_status_from_api(&request).await?;

        if statuses.is_empty() {
            return Err(OracleError::CommonError("Statuses are empty".into()));
        }

        // sort statuses by time
        statuses.sort_unstable_by_key(|status| status.time);
        println!("Sorted Statuses: {:?}", statuses);

        // check the validity of statuses
        let mut pre_status_time = request.last_status_state.time;
        let mut pre_status_status = request.last_status_state.status;

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

        let report = RequestReport::new(request.request_id.to_string(), self.oracle.id, statuses);
        println!("Generated report: {:?}", report);

        // if is_aggregator {
        println!("Inserting report to db: {:?}", report);
        let report_service = RequestReportService::new(&database);
        report_service.insert_or_update(&report).await?;
        // }

        println!("Sending report to aggregators...");
        self.send_report_to_aggregators(&request.aggregator_ids, &report).await?;
        println!("Sent report to aggregators");

        Ok(())
    }

    pub async fn send_report_to_aggregators(&self, aggregator_ids: &Vec<u8>, report: &RequestReport) -> OracleResult<()> {
        let service = StatusExchangeService::new();

        // send to all neighbors
        for aggregator_id in aggregator_ids.iter() {
            // if *aggregator_id == self.oracle.id {
            //     continue;
            // }

            let aggregator = self.get_oracle(*aggregator_id).await?;
            println!("Sending to Aggregator: {:?}", aggregator);
            service.fulfill_request(&aggregator.url, report).await?;
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

        // println!("Oracle Manager Contract address: {:?}", self.contract_address);
        let filter = Filter::new()
            .address(self.contract_address)
            .from_block(BlockNumberOrTag::Latest);

        let sub = provider.subscribe_logs(&filter).await?;
        let mut stream = sub.into_stream();

        while let Some(log) = stream.next().await {
            match log.topic0() {
                Some(&ZKOracleManager::RequestReceived::SIGNATURE_HASH) => {
                    let ZKOracleManager::RequestReceived { requestId } = log.log_decode()?.inner.data;
                    println!("RequestReceived: {:?}", requestId);
                    let contract = ZKOracleManager::new(self.contract_address, provider.clone());

                    let request = contract.getRequestById(requestId).call().await?._0;

                    println!("Handling Request: {:?}", request);
                    self.handle_new_request(&request.into()).await?;
                },
                _ => {
                    println!("None");
                }
            }
        }

        Ok(())
    }

    pub async fn check_reports(&self, request_id: &str, mechanism: StatusMechanism) -> OracleResult<()> {
        let database = db::get_db(&self.config).await?;
        let report_service = RequestReportService::new(&database);
        let num_reports = report_service.get_num_reports_by_request_id(request_id, mechanism).await?;
        println!("Number of reports: {}", num_reports);

        // check the number of agreements
        let request_service = OracleRequestService::new(&database);
        // let request = request_service.find_one(&report.request_id, mechanism).await?;
        match request_service.find_one(request_id, mechanism).await? {
            Some(r) => {
                println!("Number of agreements: {}", r.num_agreements);

                if r.num_agreements <= num_reports {
                    println!("All agreements are collected. Fulfilling the request...");
                    let reports = report_service.get_reports_by_request_id(request_id, mechanism).await?;
                    // println!("Reports: {:?}", reports);

                    // check the report validity

                    // send the valid one to the contract
                    self.send_last_status_to_contract(request_id, &reports).await?;
                    // self.send_all_statuses_to_contract(request_id, &reports).await?;
                }
            },
            None => {
                return Err(OracleError::CommonError("Request not found".to_string()));
            }
        };

        Ok(())
    }

    pub async fn send_last_status_to_contract(&self, request_id: &str, reports: &Vec<RequestReport>) -> OracleResult<()> {
        // let ws = WsConnect::new(self.config.get_solidity_ws_rpc_url());
        let provider = ProviderBuilder::new()
            .with_recommended_fillers()
            // .with_simple_nonce_management()
            // .with_cached_nonce_management()
            // .with_recommended_fillers()
            .wallet(self.wallet.clone())
            .on_http(self.config.get_solidity_http_rpc_url().parse().unwrap());
            // .await?;

        let contract = ZKOracleManager::new(self.contract_address, provider);

        let last_report = reports.last().unwrap();
        let status = last_report.statuses.last().unwrap();

        println!("fulfilling request_id: {:?}", request_id);
        let re_bytes: [u8; 32];
        match hex::decode(request_id) {
            Ok(v) => match v.as_slice().try_into() {
                Ok(v) => {
                    re_bytes = v;
                },
                Err(e) => return Err(OracleError::CommonError(format!("Cannot parse request_id: {:?} with err: {:?}", request_id, e))),
            },
            Err(e) => return Err(OracleError::CommonError(format!("Cannot parse request_id: {:?} with err: {:?}", request_id, e))),
        };

        let onchain_request_id: FixedBytes<32> = FixedBytes::from(re_bytes);

        let response_value = DynSolValue::Tuple(vec![
            DynSolValue::Uint(U256::from(status.time), 64),
            DynSolValue::Uint(U256::from(status.status), 64)
        ]);

        let response_bytes = Bytes::from(response_value.abi_encode());

        println!("Calling fulfillRequestWithLastStatus...");
        let builder = contract.fulfillRequestWithLastStatus(onchain_request_id, response_bytes.clone(), Bytes::new());
        println!("builder: {:?}", builder);

        let receipt = builder.send().await?.get_receipt().await?;
        println!("Receipt: {:?}", receipt);

        // println!("Tx: {:?}", tx);

        // let receipt = tx.get_receipt().await?;

        // println!("Gas Used: {:?}", receipt.gas_used);

        Ok(())
    }

    pub async fn send_all_statuses_to_contract(&self, request_id: &str, report: &Vec<RequestReport>) -> OracleResult<()> {


        Ok(())
    }

    pub async fn send_all_statuses_to_contract_with_zk(&self, request_id: &str, report: &Vec<RequestReport>) -> OracleResult<()> {
        Ok(())
    }
}