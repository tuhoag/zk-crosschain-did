use std::collections::HashMap;

use bson::doc;
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use zkcdid_lib_rs::{config::Config, models::{oracle_request::OracleRequest, status_state::StatusMechanism}};

use crate::errors::{OracleError, OracleResult};

pub struct OracleRequestService {
    pub collections: HashMap<StatusMechanism, Collection<OracleRequest>>,
}

impl OracleRequestService {
    pub fn new(database: &Database) -> Self {
        let config = Config::load_oracle_config();

        Self {
            collections: [
                (StatusMechanism::BitStatusList, database.collection(&format!("{}_bsl", config.get_oracle_requests_collection_name()))),
                (StatusMechanism::MerkleTree, database.collection(&format!("{}_merkle", config.get_oracle_requests_collection_name()))),
            ].into_iter().collect(),
        }
    }

    pub async fn is_existed(&self, request: &OracleRequest) -> OracleResult<bool> {
        let collection = self.collections.get(&request.status_mechanism).unwrap();
        let request_id = request.request_id.clone();

        let query = doc! {
            "request_id": doc! { "$eq": request_id }
        };

        let cursor = collection
            .find(query)
            .await?;
        let requests = cursor.try_collect::<Vec<OracleRequest>>().await?;

        Ok(requests.len() > 0)
    }

    pub async fn insert_one(&self, request: &OracleRequest) -> OracleResult<()> {
        if self.is_existed(request).await? {
            return Err(OracleError::CommonError("Request already existed".to_string()));
        }

        let collection = self.collections.get(&request.status_mechanism).unwrap();
        collection.insert_one(request).await?;
        Ok(())
    }
}