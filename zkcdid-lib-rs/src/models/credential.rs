use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// use crate::utils::serializer::calculate_sha256_hash;

use super::status_state::StatusMechanism;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Credential {
    #[serde(
        rename = "_id",
        skip_serializing_if = "Option::is_none",
        serialize_with = "crate::utils::serializer::serialize_object_id_as_string",
        deserialize_with = "crate::utils::serializer::deserialize_object_id"
    )]
    pub id: Option<ObjectId>,
    pub subject: String,
    pub data: HashMap<String, String>,
    pub status_mechanism: StatusMechanism,
    pub index: u64,
    pub issuance_status_url: String,
    pub revocation_status_url: String,
    pub time: u64,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
}

impl Credential {
    pub fn new(
        subject: &str,
        data: &HashMap<String, String>,
        status_mechanism: &StatusMechanism,
        index: u64,
        issuance_status_url: &str,
        revocation_status_url: &str,
        time: u64,
    ) -> Self {
        Self {
            id: None,
            subject: subject.to_string(),
            data: data.clone(),
            status_mechanism: *status_mechanism,
            index,
            issuance_status_url: issuance_status_url.to_string(),
            revocation_status_url: revocation_status_url.to_string(),
            time,
            hash: None,
            signature: None,
        }
    }

    pub fn get_sample_credential() -> Credential {
        let data = HashMap::new();
        let credential = Credential::new(
            "holder1",
            &data,
            &StatusMechanism::BitStatusList,
            0,
            "status_url",
            "revocation_url",
            0,
        );
        credential
    }

    // pub fn calculate_hash_sha256(&self) -> Vec<u8> {
    //     let mut credential = self.clone();
    //     credential.id = None;
    //     credential.hash = None;
    //     credential.signature = None;

    //     let json_data = serde_json::to_vec(&credential).unwrap();
    //     // calculate_sha256_hash(&json_data)
    // }

    // pub fn update_hash_sha256(&mut self) {
    //     self.hash = Some(general_purpose::STANDARD.encode(&self.calculate_hash_sha256()));
    // }

    // pub fn calculate_hash_poseidon(&self) -> Vec<u8> {
    //     unimplemented!()
    // }


    // pub fn calculate_signature(&self, private_key: &[u8]) -> Signature {
    //     let hash = self.calculate_hash();

    //     Signature {r, s }
    // }
}
