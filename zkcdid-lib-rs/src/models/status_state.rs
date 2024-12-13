use std::fmt::{self, Display, Formatter};

use bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

use crate::{status_exchange, utils::serializer::{base64_to_u64, u64_to_base64}};

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
    Issuance = 1,

    #[serde(rename = "revocation")]
    Revocation = 2,
}

impl Display for StatusType {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        serde_json::to_string(self).unwrap().trim_matches('"').fmt(f)
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct StatusState {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        default,
        serialize_with = "crate::utils::serializer::serialize_object_id_as_string",
        deserialize_with = "crate::utils::serializer::deserialize_object_id"
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

impl From<i32> for StatusMechanism {
    fn from(status_mechanism: i32) -> Self {
        match status_mechanism {
            0 => StatusMechanism::BitStatusList,
            1 => StatusMechanism::MerkleTree,
            _ => panic!("Invalid status mechanism"),
        }
    }
}

impl From<i32> for StatusType {
    fn from(status_type: i32) -> Self {
        // println!("Converting status_type: {}", status_type);
        match status_type {
            // 0 => StatusType::Invalid,
            1 => {
                // println!("Converting status_type: {} into Issuance", status_type);
                StatusType::Issuance
            },
            2 => {
                // println!("Converting status_type: {} into Revocation", status_type);
                StatusType::Revocation
            },
            _ => panic!("Invalid status type"),
        }
    }
}

impl From<status_exchange::StatusMessage> for StatusState {
    fn from(status_message: status_exchange::StatusMessage) -> Self {
        Self {
            id: None,
            time: status_message.time,
            status_mechanism: status_message.status_mechanism.into(),
            status_type: status_message.status_type.into(),
            status: status_message.status,
            proof: if status_message.proof.is_empty() { None } else { Some(status_message.proof) },
            signature: if status_message.signature.is_empty() { None } else { Some(status_message.signature) },
        }
    }
}

impl From<StatusState> for status_exchange::StatusMessage {
    fn from(status_state: StatusState) -> Self {
        let id = status_state.id.unwrap_or_default().to_hex().to_string();
        let proof = status_state.proof.unwrap_or_default();
        let signature = status_state.signature.unwrap_or_default();

        status_exchange::StatusMessage {
            id: id,
            time: status_state.time,
            status_mechanism: status_state.status_mechanism as i32,
            status_type: status_state.status_type as i32,
            status: status_state.status,
            proof: proof,
            signature: signature,
        }
    }
}

// impl Into<StatusMessage> for StatusState {
//     fn into(self) -> StatusMessage {
//         // let id = match self.id {
//         //     Some(object_id) => object_id.to_hex().to_string(),
//         //     None => "".to_string(),
//         // };
//         let id = self.id.unwrap_or_default().to_hex().to_string();
//         let proof = self.proof.unwrap_or_default();
//         let signature = self.signature.unwrap_or_default();

//         StatusMessage {
//             id: id,
//             time: self.time,
//             status_mechanism: self.status_mechanism as i32,
//             status_type: self.status_type as i32,
//             status: self.status,
//             proof: proof,
//             signature: signature,
//         }
//     }
// }