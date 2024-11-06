use serde::{Deserialize, Serialize};

use crate::utils::{base64_to_u64, u64_to_base64};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, Hash, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StatusType {
    #[serde(rename = "bsl")]
    BitStatusList = 0,
    #[serde(rename = "mt")]
    MerkleTree = 1,
}

impl StatusType {
    pub fn count () -> usize {
        2
    }

    pub fn as_index(&self) -> usize {
        *self as usize
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct StatusState {
    #[serde(serialize_with = "u64_to_base64", deserialize_with = "base64_to_u64")]
    pub status: u64,
    pub time: u64,
    pub proof: String,
    pub status_type: StatusType,
    pub num_credentials: u64,
    pub signature: String,
}

impl StatusState {
    pub fn new(status: u64, time: u64, proof: &str, status_type: StatusType, num_credentials: u64, signature: &str) -> Self {
        Self {
            status: status,
            time: time,
            proof: proof.to_string(),
            status_type,
            num_credentials,
            signature: signature.to_string(),
        }
    }

    pub fn get_sample_status() -> StatusState {
        let status = StatusState::new(0, 0, "proof", StatusType::BitStatusList, 0, "signature");
        status
    }

    pub fn revoke_credential(&mut self, id: u64) {
        self.status = self.status | (1 << id);
    }
}
