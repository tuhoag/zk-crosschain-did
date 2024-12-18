use alloy::hex::ToHexExt;
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use crate::contracts::ZKOracleManager;

use super::status_state::{StatusMechanism, StatusState, StatusType};

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct OracleRequest {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "crate::utils::serializer::serialize_object_id_as_string",
        deserialize_with = "crate::utils::serializer::deserialize_object_id"
    )]
    pub id: Option<ObjectId>,

    pub request_id: String,
    pub url: String,
    pub last_status_state: StatusState,
    pub status_type: StatusType,
    pub status_mechanism: StatusMechanism,
    pub subscription_id: u64,
    pub callback_gas_limit: u32,
    pub aggregator_ids: Vec<u8>,
    pub num_agreements: u8,
}

impl OracleRequest {
    pub fn new(request_id: &str, url: &str, last_status_state: &StatusState, status_type: StatusType, status_mechanism: StatusMechanism, subscription_id: u64, callback_gas_limit: u32, aggregator_ids: &Vec<u8>, num_agreements: u8) -> Self {
        Self {
            id: None,
            request_id: request_id.to_string(),
            url: url.to_string(),
            last_status_state: last_status_state.clone(),
            status_type,
            status_mechanism,
            subscription_id,
            callback_gas_limit,
            aggregator_ids: aggregator_ids.clone(),
            num_agreements,
        }
    }
}

impl From<ZKOracleManager::Request> for OracleRequest {
    fn from(value: ZKOracleManager::Request) -> Self {
        let request_id = value.requestId.encode_hex();
        let url = value.url;
        let status_mechanism = (value.statusMechanism as i32).into();
        let status_type = (value.statusType as i32).into();

        let last_status_state = StatusState::new(
            value.lastStatusState.status,
            value.lastStatusState.time,
            status_mechanism,
            status_type
        );
        let status_type = status_type;
        let status_mechanism = status_mechanism;
        let subscription_id = value.subscriptionId;
        let callback_gas_limit = value.callbackGasLimit;
        let aggregator_ids = value.aggregatorIds;
        let num_agreements = value.numAgreements;

        Self::new(&request_id, &url, &last_status_state, status_type, status_mechanism, subscription_id, callback_gas_limit, &aggregator_ids, num_agreements)
    }
}