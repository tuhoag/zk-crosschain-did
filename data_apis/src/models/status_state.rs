use std::fmt::{self, Display, Formatter};

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

use crate::utils::{base64_to_u64, u64_to_base64};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, Hash, PartialEq, Eq, EnumIter)]
#[serde(rename_all = "lowercase")]
pub enum StatusMechanism {
    #[serde(rename = "bsl")]
    BitStatusList = 0,
    #[serde(rename = "mt")]
    MerkleTree = 1,
}

impl StatusMechanism {
    pub fn count () -> usize {
        2
    }

    pub fn as_index(&self) -> usize {
        *self as usize
    }
}

impl Display for StatusMechanism {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        serde_json::to_string(self).unwrap().trim_matches('"').fmt(f)
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, EnumIter)]
pub enum StatusType {
    #[serde(rename = "issuance")]
    Issuance,

    #[serde(rename = "revocation")]
    Revocation,
}

impl Display for StatusType {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        serde_json::to_string(self).unwrap().trim_matches('"').fmt(f)
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct StatusState {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
    )]
    pub id: Option<ObjectId>,
    pub time: u64,
    pub status_mechanism: StatusMechanism,
    pub status_type: StatusType,

    #[serde(serialize_with = "u64_to_base64", deserialize_with = "base64_to_u64")]
    pub status: u64,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub proof: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

impl StatusState {
    pub fn new(status: u64, time: u64, status_mechanism: StatusMechanism, status_type: StatusType) -> Self {
        Self {
            id: None,
            status: status,
            time: time,
            proof: None,
            status_mechanism,
            status_type,
            signature: None,
        }
    }

    pub fn get_initial_status(status_mechanism: StatusMechanism, status_type: StatusType) -> StatusState {
        // let time = chrono::Utc::now().timestamp() as u64;
        let time = 0;
        match status_mechanism {
            StatusMechanism::BitStatusList => {
                StatusState::new(0, time, status_mechanism, status_type)
            }
            StatusMechanism::MerkleTree => {
                unimplemented!()
            }
        }
    }
    pub fn get_sample_status() -> StatusState {
        let status = StatusState::new(0, 0, StatusMechanism::BitStatusList, StatusType::Revocation);
        status
    }

    pub fn update_index_status(&mut self, id: u64) {
        self.status = self.status | (1 << id);
    }
}
