use bson::{doc, Bson};
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use strum::IntoEnumIterator;
use zkcdid_lib_rs::{config::Config, models::{request_params::StatusQueryParams, status_state::{StatusMechanism, StatusState, StatusType}}};
use std::collections::HashMap;

use crate::errors::ApiResult;


#[derive(Debug, Clone)]
pub struct StatusService {
    pub collections: HashMap<(StatusMechanism, StatusType), Collection<StatusState>>,
}

impl StatusService {
    fn get_collection_name(collection_name: &str, status_mechanism: &StatusMechanism, status_type: &StatusType) -> String {
        format!("{:?}_{:?}_{:?}",serde_json::to_string(status_type), collection_name, serde_json::to_string(status_mechanism))
    }

    pub fn new(database: &Database) -> Self {
        let mut collections = HashMap::new();
        let config = Config::load_api_config();


        for status_mechanism in StatusMechanism::iter() {
            for status_type in StatusType::iter() {
                let collection_name = Self::get_collection_name(config.get_statuses_collection_name(), &status_mechanism, &status_type);
                let collection = database.collection(&collection_name);
                collections.insert((status_mechanism, status_type), collection);
            }
        }

        Self {
            collections
        }
    }

    pub async fn reset(&self) -> ApiResult<()> {
        self.delete_all().await?;
        self.insert_first_status().await?;
        Ok(())
    }

    pub async fn initialize(&self) -> ApiResult<()> {
        // create the first status
        self.insert_first_status().await?;
        Ok(())
    }

    pub async fn insert_first_status(&self) -> ApiResult<()> {
        // create the first status
        for status_type in StatusType::iter() {
            let first_status = StatusState::get_initial_status(StatusMechanism::BitStatusList, status_type);
            self.insert_one(&first_status).await?;
        }


        Ok(())
    }

    fn get_collection(&self, status_mechanism: &StatusMechanism, status_type: &StatusType) -> ApiResult<&Collection<StatusState>> {
        match self.collections.get(&(*status_mechanism, *status_type)) {
            Some(collection) => Ok(collection),
            None => Err("Collection not found".into())
        }
    }

    pub async fn insert_one(&self, status: &StatusState) -> ApiResult<()> {
        let collection = self.get_collection(&status.status_mechanism, &status.status_type)?;
        collection.insert_one(status).await?;
        Ok(())
    }

    pub async fn get_statuses(&self, status_mechanism: &StatusMechanism, status_type: &StatusType, query: &StatusQueryParams) -> ApiResult<Vec<StatusState>> {
        let start_time = Bson::Int64(query.time.unwrap_or(0) as i64);
        let collection = self.get_collection(status_mechanism, status_type)?;
        let cursor = collection
            .find(doc! {
               "time": doc! { "$gte": start_time }
            })
            .await?;
        let statuses = cursor.try_collect::<Vec<StatusState>>().await?;
        Ok(statuses)
    }

    pub async fn get_latest_status(&self, status_mechanism: &StatusMechanism, status_type: &StatusType) -> ApiResult<StatusState> {
        // Find the document with the highest time value
        let collection = self.get_collection(status_mechanism, status_type)?;
        let status = collection
            .find_one(doc! {})
            .sort(doc! { "time": -1 })
            .await?;

        // Return the document if it exists
        Ok(status.unwrap())
    }

    pub async fn delete_all(&self) -> ApiResult<()> {
        for collection in self.collections.values() {
            collection.delete_many(doc! {}).await?;
        }

        Ok(())
    }
}

