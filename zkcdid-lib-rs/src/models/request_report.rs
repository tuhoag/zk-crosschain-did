use bson::{oid::ObjectId, Bson};
use serde::{Deserialize, Serialize};

use crate::status_exchange;

use super::status_state::StatusState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RequestReport {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "crate::utils::serializer::serialize_object_id_as_string",
        deserialize_with = "crate::utils::serializer::deserialize_object_id"
    )]
    pub id: Option<ObjectId>,

    pub request_id: String,

    pub oracle_id: u8,

    pub statuses: Vec<StatusState>,
}

impl RequestReport {
    pub fn new(request_id: String, oracle_id: u8, statuses: Vec<StatusState>) -> Self {
        Self {
            id: None,
            request_id,
            oracle_id,
            statuses,
        }
    }
}

impl From<status_exchange::RequestFulfillment> for RequestReport {
    fn from(value: status_exchange::RequestFulfillment) -> Self {
        let request_id = value.request_id;
        let oracle_id = value.oracle_id as u8;
        let statuses = value.statuses
            .iter()
            .map(|status_message| StatusState::from(status_message.clone()))
            .collect();

        Self::new(request_id, oracle_id, statuses)
    }
}

// impl From<RequestReport> for bson::Document {
//     fn from(value: RequestReport) -> bson::Document {
//         bson::doc! {
//             "request_id": value.request_id,
//             "oracle_id": value.oracle_id as i32,
//             "statuses": value.statuses.into_iter().map(|status| status.into()).collect::<Vec<Bson>>(),
//         }
//     }
// }