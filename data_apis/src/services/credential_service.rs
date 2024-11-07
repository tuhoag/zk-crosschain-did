use std::collections::HashMap;

use bson::{doc, oid::ObjectId};
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use url::Url;

use crate::{config::{Config, DEFAULT_CREDENTIALS_COLLECTION_NAME}, errors::AppResult, models::{credential::Credential, request_params::CredentialIssuanceParams, status_state::{StatusMechanism, StatusType}}};

use super::status_service::StatusService;


#[derive(Debug, Clone)]
pub struct CredentialService {
    pub collections: HashMap<StatusMechanism, Collection<Credential>>,
}

impl CredentialService {
    pub fn new(database: &Database) -> Self {
        Self {
            collections: [
                (StatusMechanism::BitStatusList, database.collection(&format!("{}_bsl", DEFAULT_CREDENTIALS_COLLECTION_NAME))),
                (StatusMechanism::MerkleTree, database.collection(&format!("{}_merkle", DEFAULT_CREDENTIALS_COLLECTION_NAME))),
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

    pub async fn insert_one(&self, credential: &mut Credential) -> AppResult<()> {
        let collection = self.collections.get(&credential.status_mechanism).unwrap();
        let res = collection.insert_one(&mut *credential).await?;
        credential.id = res.inserted_id.as_object_id();
        Ok(())
    }

    pub async fn get_credential_by_id(&self, status_mechanism: &StatusMechanism, id: &str) -> AppResult<Credential> {
        let object_id = ObjectId::parse_str(id)?;
        let collection = self.collections.get(&status_mechanism).unwrap();
        let filter = doc! { "_id": object_id};
        let credential = collection.find_one(filter).await?;

        Ok(credential.unwrap())
    }

    pub async fn get_all_credentials(&self, status_mechanism: StatusMechanism) -> AppResult<Vec<Credential>> {
        let collection = self.collections.get(&status_mechanism).unwrap();
        let cursor = collection.find(doc! {}).await?;
        let credentials = cursor.try_collect::<Vec<Credential>>().await?;
        Ok(credentials)
    }

    pub async fn get_next_credential_index(&self, status_mechanism: &StatusMechanism) -> AppResult<u64> {
        let collection = self.collections.get(&status_mechanism).unwrap();
        let credential = collection
            .find_one(doc! {})
            .sort(doc! { "index": -1 })
            .await?;

        match credential {
            Some(credential) => {
                if credential.index == u64::MAX {
                    return Err("Credential index overflow".into());
                }

                return Ok(credential.index + 1);
            },
            None => Ok(0),
        }
    }

    fn build_status_url(status_mechanism: &StatusMechanism, status_type: &StatusType, base_url: &str) -> AppResult<String> {
        let mut api_url = Url::parse(base_url)?;
        api_url = api_url.join(&format!("statuses/{}/{}", status_mechanism, status_type))?;
        // api_url = api_url.join(&serde_json::to_string(status_mechanism)?)?;
        // api_url = api_url.join(&serde_json::to_string(status_type)?)?;
            // .join("statuses")?
            // .join(&serde_json::to_string(status_mechanism)?)?
            // .join(&serde_json::to_string(status_type)?)?;

        Ok(api_url.to_string())
    }

    pub async fn issue_credential(&self, issuance_params: &CredentialIssuanceParams, status_mechanism: &StatusMechanism, status_service: &StatusService, config: &Config) -> AppResult<Credential> {
        // get status url
        let issuance_status_url = Self::build_status_url(status_mechanism, &StatusType::Issuance, &config.api_url)?;
        let revocation_status_url = Self::build_status_url(status_mechanism, &StatusType::Revocation, &config.api_url)?;

        // get the highest index of all credentials
        let index = self.get_next_credential_index(status_mechanism).await?;

        // get current time
        let time = chrono::Utc::now().timestamp() as u64;

        // create a new credential
        let mut credential = Credential::new(
            &issuance_params.subject,
            &issuance_params.data,
            status_mechanism,
            index,
            &issuance_status_url,
            &revocation_status_url,
            time,
        );
        credential.update_hash_sha256();

        self.insert_one(&mut credential).await?;

        // update issuance status
        let mut last_issuance_status = status_service.get_latest_status(status_mechanism, &StatusType::Issuance).await?;
        last_issuance_status.update_index_status(index);
        last_issuance_status.id = None;
        last_issuance_status.time = time;
        last_issuance_status.signature = None;
        status_service.insert_one(&last_issuance_status).await?;

        Ok(credential)
    }

    pub async fn revoke_credential(&self, id: &str, status_mechanism: &StatusMechanism, status_service: &StatusService) -> AppResult<Credential> {
        // get the credential by id
        let credential = self.get_credential_by_id(status_mechanism, id).await?;

        let mut last_revocation_status = status_service.get_latest_status(status_mechanism, &StatusType::Revocation).await?;
        last_revocation_status.update_index_status(credential.index);
        last_revocation_status.id = None;
        last_revocation_status.time = chrono::Utc::now().timestamp() as u64;
        last_revocation_status.signature = None;
        status_service.insert_one(&last_revocation_status).await?;

        Ok(credential)
    }
}