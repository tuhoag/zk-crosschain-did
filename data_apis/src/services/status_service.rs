use bson::{doc, Bson};
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use std::collections::HashMap;

use crate::{
    config::DEFAULT_STATUSES_COLLECTION_NAME, errors::AppResult, models::{request_params::StatusQueryParams, status_state::{StatusState, StatusType}}
};

#[derive(Debug, Clone)]
pub struct StatusService {
    pub collections: HashMap<StatusType, Collection<StatusState>>,
}

impl StatusService {
    pub fn new(database: &Database) -> Self {
        Self {
            collections: [
                (StatusType::BitStatusList, database.collection(&format!("{}_bsl", DEFAULT_STATUSES_COLLECTION_NAME))),
                (StatusType::MerkleTree, database.collection(&format!("{}_merkle", DEFAULT_STATUSES_COLLECTION_NAME))),
            ].into_iter().collect(),
        }
    }

    pub async fn reset(&self) -> AppResult<()> {
        self.delete_all().await?;
        self.insert_first_status().await?;
        Ok(())
    }

    pub async fn initialize(&self) -> AppResult<()> {
        // create the first status
        self.insert_first_status().await?;
        Ok(())
    }

    pub async fn insert_first_status(&self) -> AppResult<()> {
        // create the first status
        let first_status = StatusState::new(0, 0, "proof", StatusType::BitStatusList, 0, "signature");
        self.insert_one(&first_status).await?;
        Ok(())
    }

    pub async fn insert_one(&self, status: &StatusState) -> AppResult<()> {
        self.collections.get(&status.status_type).unwrap().insert_one(status).await?;

        Ok(())
    }

    pub async fn get_statuses(&self, status_type: StatusType, query: &StatusQueryParams) -> AppResult<Vec<StatusState>> {
        let start_time = Bson::Int64(query.time.unwrap_or(0) as i64);
        let collection = self.collections.get(&status_type).unwrap();
        let cursor = collection
            .find(doc! {
               "time": doc! { "$gte": start_time }
            })
            .await?;
        let statuses = cursor.try_collect::<Vec<StatusState>>().await?;
        Ok(statuses)
    }

    pub async fn get_latest_status(&self, status_type: StatusType) -> AppResult<StatusState> {
        // Find the document with the highest time value
        let collection = self.collections.get(&status_type).unwrap();
        let status = collection
            .find_one(doc! {})
            .sort(doc! { "time": -1 })
            .await?;

        // Return the document if it exists
        Ok(status.unwrap())
    }

    pub async fn delete_all(&self) -> AppResult<()> {
        for collection in self.collections.values() {
            collection.delete_many(doc! {}).await?;
        }

        Ok(())
    }
}

