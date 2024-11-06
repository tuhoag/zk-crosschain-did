use base64::{engine::general_purpose, Engine};
use mongodb::Database;
use serde::{Deserialize, Deserializer, Serializer};
use sha2::{Digest, Sha256};

use crate::{config::Config, db, errors::AppResult, services::{credential_service::CredentialService, status_service::StatusService}};

pub fn u64_to_base64<S>(num: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let num_bytes = num.to_be_bytes(); // Convert u64 to bytes
    let base64_encoded = general_purpose::STANDARD.encode(&num_bytes); // Encode bytes to Base64
    serializer.serialize_str(&base64_encoded) // Serialize as a string
}

// Custom deserialization function to convert Base64 string to `u64`
pub fn base64_to_u64<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let base64_str: &str = Deserialize::deserialize(deserializer)?;
    let decoded_bytes = general_purpose::STANDARD.decode(base64_str).map_err(serde::de::Error::custom)?;

    // Ensure the decoded bytes have the correct length for a `u64` (8 bytes)
    if decoded_bytes.len() != 8 {
        return Err(serde::de::Error::custom("Invalid length for u64"));
    }

    // Convert bytes to u64
    let mut num_bytes = [0u8; 8];
    num_bytes.copy_from_slice(&decoded_bytes);
    Ok(u64::from_be_bytes(num_bytes))
}

#[derive(Debug, Clone)]
pub struct AppData {
    pub database: Database,
    pub status_service: StatusService,
    pub credential_service: CredentialService,
    pub config: Config,
}

impl AppData {
    pub async fn new(config: &Config) -> AppResult<Self> {
        match db::get_db(config).await {
            Ok(database) => {
                let status_service = StatusService::new(&database);
                let credential_service = CredentialService::new(&database);

                Ok(Self {
                    database: database,
                    status_service: status_service,
                    credential_service: credential_service,
                    config: config.clone(),
                })
            }
            Err(e) => Err(e),
        }
    }
}

pub fn calculate_hash(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}