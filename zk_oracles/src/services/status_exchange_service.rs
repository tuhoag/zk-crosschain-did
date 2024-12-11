use crate::errors::OracleResult;
use status_exchange::{status_exchange_service_client::StatusExchangeServiceClient, HelloRequest, StatusMessage};
use zkcdid_lib_rs::{config::Config, models::status_state::StatusState};

pub mod status_exchange {
    tonic::include_proto!("status_exchange");
}

impl Into<StatusMessage> for StatusState {
    fn into(self) -> StatusMessage {
        // let id = match self.id {
        //     Some(object_id) => object_id.to_hex().to_string(),
        //     None => "".to_string(),
        // };
        let id = self.id.unwrap_or_default().to_hex().to_string();
        let proof = self.proof.unwrap_or_default();
        let signature = self.signature.unwrap_or_default();

        StatusMessage {
            id: id,
            time: self.time,
            status_mechanism: self.status_mechanism as i32,
            status_type: self.status_type as i32,
            status: self.status,
            proof: proof,
            signature: signature,
        }
    }
}

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

    pub async fn fulfill_request(&self, url: &str, statuses: &Vec<StatusState>) -> OracleResult<bool> {
        let mut client = StatusExchangeServiceClient::connect(url.to_string()).await?;

        let status_messages = statuses.iter().map(|status| {
        ((*status).clone()).into()
        }).collect();

        let request = tonic::Request::new(status_exchange::RequestFulfillment {
            oracle_id: self.config.get_id().into(),
            request_id: 1,
            statuses: status_messages,
        });

        let response = client.fulfill_request(request).await?;
        Ok(response.into_inner().result)
    }
}