use crate::errors::OracleResult;
use zkcdid_lib_rs::{config::Config, models::request_report::RequestReport, status_exchange::{self, status_exchange_service_client::StatusExchangeServiceClient, HelloRequest}};


pub struct StatusExchangeService {
    config: Config,
}

impl StatusExchangeService {
    pub fn new() -> Self {
        Self {
            config: Config::load_oracle_config()
        }
    }

    pub async fn say_hello(&self, url: &str, name: &str) -> OracleResult<String> {
        let mut client = StatusExchangeServiceClient::connect(url.to_string()).await?;

        let request = tonic::Request::new(HelloRequest {
            oracle_id: self.config.get_id().into(),
            name: name.into(),
        });

        let response = client.say_hello(request).await?;
        Ok(response.into_inner().message)
    }

    pub async fn fulfill_request(&self, url: &str, report: &RequestReport) -> OracleResult<bool> {
        let mut client = StatusExchangeServiceClient::connect(url.to_string()).await?;

        let status_messages = report.statuses.iter().map(|status| {
        ((*status).clone()).into()
        }).collect();

        let request = tonic::Request::new(status_exchange::RequestFulfillment {
            oracle_id: self.config.get_id().into(),
            request_id: report.request_id.clone(),
            statuses: status_messages,
        });

        let response = client.fulfill_request(request).await?;
        Ok(response.into_inner().result)
    }
}