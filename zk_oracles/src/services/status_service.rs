use zkcdid_lib_rs::{config::Config, models::status_state::StatusState};
use reqwest::Client;

use crate::errors::{OracleError, OracleResult};

use super::oracle_manager_service::ZKOracleManager::Request;

pub struct StatusService {
    config: Config,
}

impl StatusService {
    pub fn new() -> Self {
        Self {
            config: Config::load_oracle_config(),
        }
    }

    pub async fn get_status_from_api(&self, request: &Request) -> OracleResult<Vec<StatusState>> {
        let domain = request.url.clone();

        let status_mechanism = match request.statusMechanism {
            0 => "bsl",
            1 => "mt",
            n => {
                return Err(OracleError::CommonError(format!("Invalid status mechanism: {:?}", n)));
            },
        };

        let status_type = match request.statusType {
            1 => "issuance",
            2 => "revocation",
            n => {
                return Err(OracleError::CommonError(format!("Invalid status type: {:?}", n)));
            }
        };

        let last_status_time = request.lastStatusState.time;
        let url = format!("{}/statuses/{}/{}?time={}", domain, status_mechanism, status_type, last_status_time);

        // println!("URL: {:?}", url);
        // let url = format!("{}/status", self.config.get_api_url());
        let response = Client::new().get(url).send().await?;

        if response.status().is_success() {
            let str_response = response.text().await?;
            // println!("txt Response: {:?}", str_response);
            let statuses: Vec<StatusState> = serde_json::from_str(&str_response)?;
            // println!("Statuses: {:?}", statuses[0]);
            // let status = response.json().await?;
            // let status = StatusState::get_sample_status();
            return Ok(statuses);
        } else {
            return Err(OracleError::CommonError("Failed to get status from API".to_string()));
        }
    }
}