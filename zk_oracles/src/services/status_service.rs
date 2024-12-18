use zkcdid_lib_rs::models::{oracle_request::OracleRequest, status_state::{StatusMechanism, StatusState, StatusType}};
use reqwest::Client;

use crate::errors::{OracleError, OracleResult};

pub struct StatusService {
    // config: Config,
}

impl StatusService {
    pub fn new() -> Self {
        Self {
            // config: Config::load_oracle_config(),
        }
    }

    pub async fn get_status_from_api(&self, request: &OracleRequest) -> OracleResult<Vec<StatusState>> {
        let domain = request.url.clone();
        let status_mechanism = match request.status_mechanism {
            StatusMechanism::BitStatusList => "bsl",
            StatusMechanism::MerkleTree => "mt",
        };
        let status_type = match request.status_type {
            StatusType::Issuance => "issuance",
            StatusType::Revocation => "revocation",
        };

        let last_status_time = request.last_status_state.time;
        let url = format!("{}/statuses/{}/{}?time={}", domain, status_mechanism, status_type, last_status_time);

        println!("Getting statuses url: {:?}", url);
        // let url = format!("{}/status", self.config.get_api_url());
        let response = Client::new().get(url).send().await?;
        println!("Response: {:?}", response);

        if response.status().is_success() {
            let str_response = response.text().await?;
            // println!("txt Response: {:?}", str_response);
            let mut statuses: Vec<StatusState> = serde_json::from_str(&str_response)?;
            for status in statuses.iter_mut() {
                status.id = None;
            }
            // println!("Statuses: {:?}", statuses[0]);
            // let status = response.json().await?;
            // let status = StatusState::get_sample_status();
            return Ok(statuses);
        } else {
            return Err(OracleError::CommonError("Failed to get status from API".to_string()));
        }
    }
}