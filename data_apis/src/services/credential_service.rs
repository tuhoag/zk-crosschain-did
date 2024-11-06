use std::collections::HashMap;

use bson::{doc, oid::ObjectId};
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};

use crate::{config::DEFAULT_CREDENTIALS_COLLECTION_NAME, errors::AppResult, models::{credential::Credential, status_state::StatusType}};


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

    pub async fn insert_one(&self, credential: &mut Credential) -> AppResult<()> {
        let collection = self.collections.get(&credential.status_type).unwrap();
        let res = collection.insert_one(&mut *credential).await?;
        credential.id = res.inserted_id.as_object_id();
        Ok(())
    }

    pub async fn get_credential_by_id(&self, status_type: &StatusType, id: &str) -> AppResult<Credential> {
        let object_id = ObjectId::parse_str(id)?;
        let collection = self.collections.get(&status_type).unwrap();
        let filter = doc! { "_id": object_id};
        let credential = collection.find_one(filter).await?;

        Ok(credential.unwrap())
    }

    pub async fn get_all_credentials(&self, status_type: StatusType) -> AppResult<Vec<Credential>> {
        let collection = self.collections.get(&status_type).unwrap();
        let cursor = collection.find(doc! {}).await?;
        let credentials = cursor.try_collect::<Vec<Credential>>().await?;
        Ok(credentials)
    }
}