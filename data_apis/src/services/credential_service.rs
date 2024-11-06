use std::collections::HashMap;

use bson::{doc, Bson};
use mongodb::{Collection, Database};

use crate::{config::{Config, DEFAULT_CREDENTIALS_COLLECTION_NAME}, errors::AppResult, models::{credential::Credential, request_params::CredentialIssuanceParams, status_state::{StatusState, StatusType}}};

use super::status_service::StatusService;

#[derive(Debug, Clone)]
pub struct CredentialService {
    pub collections: HashMap<StatusType, Collection<Credential>>,
}

impl CredentialService {
    pub fn new(database: &Database) -> Self {
        Self {
            collections: [
                (StatusType::BitStatusList, database.collection(&format!("{}_bsl", DEFAULT_CREDENTIALS_COLLECTION_NAME))),
                (StatusType::MerkleTree, database.collection(&format!("{}_merkle", DEFAULT_CREDENTIALS_COLLECTION_NAME))),
            ].into_iter().collect(),
        }
    }

    pub async fn delete_all(&self) -> AppResult<()> {
        for collection in self.collections.values() {
            collection.delete_many(doc! {}).await?;
        }

        Ok(())
    }

    pub async fn reset(&self) -> AppResult<()> {
        self.delete_all().await?;
        Ok(())
    }

    pub async fn issue(&self, issuance_params: &CredentialIssuanceParams, status_type: &StatusType, status_service: &StatusService, config: &Config) -> AppResult<Credential> {
        let last_status = status_service.get_latest_status(*status_type).await.unwrap();
        let status_url = config.api_url.clone();

        let mut credential = Credential::new(&issuance_params.subject, &issuance_params.data, last_status.status_type, last_status.num_credentials, &status_url, last_status.time);
        credential.update_hash();

        self.insert_one(&mut credential).await?;
        Ok(credential)
    }

    pub async fn insert_one(&self, credential: &mut Credential) -> AppResult<()> {
        let collection = self.collections.get(&credential.status_type).unwrap();
        collection.insert_one(&mut *credential).await?;
        // credential.id = res.inserted_id.as_object_id();
        Ok(())
    }

    pub async fn get_credential(&self, status_type: StatusType, id: u64) -> AppResult<Credential> {
        let collection = self.collections.get(&status_type).unwrap();
        let filter = doc! { "_id": Bson::Int64(id as i64) };
        let credential = collection.find_one(filter).await?;

        Ok(credential.unwrap())
    }
}