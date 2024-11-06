use base64::{engine::general_purpose, Engine};
use std::collections::HashMap;
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};


use crate::utils::calculate_hash;

use super::status_state::StatusType;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Credential {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub subject: String,
    pub data: HashMap<String, String>,
    pub status_type: StatusType,
    pub index: u64,
    pub status_url: String,
    pub time: u64,

    #[serde(skip_serializing_if="Option::is_none")]
    pub hash: Option<String>,

    #[serde(skip_serializing_if="Option::is_none")]
    pub signature: Option<String>,
}

impl Credential {
    pub fn new(subject: &str, data: &HashMap<String, String>, status_type: StatusType, index: u64, status_url: &str, time: u64) -> Self {
        Self {
            id: None,
            subject: subject.to_string(),
            data: data.clone(),
            status_type,
            index,
            status_url: status_url.to_string(),
            time,
            hash: None,
            signature: None,
        }
    }

    pub fn get_sample_credential() -> Credential {
        let data = HashMap::new();
        let credential = Credential::new("holder1", &data, StatusType::BitStatusList, 0, "status_url", 0);
        credential
    }

    pub fn calculate_hash(&self) -> Vec<u8> {
        let mut credential = self.clone();
        credential.id = None;

        let json_data = serde_json::to_vec(&credential).unwrap();
        calculate_hash(&json_data)
    }

    pub fn update_hash(&mut self) {
        self.hash = Some(general_purpose::STANDARD.encode(&self.calculate_hash()));
    }

    // pub fn calculate_signature(&self, private_key: &[u8]) -> Signature {
    //     let hash = self.calculate_hash();



    //     Signature {r, s }
    // }
}