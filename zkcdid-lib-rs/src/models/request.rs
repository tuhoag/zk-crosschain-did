use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use super::status_state::StatusState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Request {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    pub request_id: u64,

    pub oracle_id: u8,

    pub statuses: Vec<StatusState>,
}