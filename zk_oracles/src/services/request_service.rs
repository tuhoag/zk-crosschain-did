use std::collections::HashMap;

use bson::doc;
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use zkcdid_lib_rs::{config::Config, models::{request::Request, status_state::StatusMechanism}};

use crate::errors::{OracleError, OracleResult};

struct RequestService {
    pub collections: HashMap<StatusMechanism, Collection<Request>>,
}

impl RequestService {
    pub fn new(database: &Database) -> Self {
        let config = Config::load_oracle_config();

        Self {
            collections: [
                (StatusMechanism::BitStatusList, database.collection(&format!("{}_bsl", config.get_requests_collection_name()))),
                (StatusMechanism::MerkleTree, database.collection(&format!("{}_merkle", config.get_requests_collection_name()))),
            ].into_iter().collect(),
        }
    }

    pub async fn check_if_request_if_fulfilled(&self, request: &Request) -> OracleResult<bool> {
        if request.statuses.is_empty() {
            return Ok(true);
        }

        let mechanism = request.statuses[0].status_mechanism;
        let collection = self.collections.get(&mechanism).unwrap();
        let request_id = request.request_id as i32;
        let oracle_id = request.oracle_id as i32;

        let query = doc! {
            "$and": [
                doc! { "request_id": doc! { "$eq": request_id } },
                doc! { "oracle_id": doc! { "$eq": oracle_id } },
            ]
        };

        let cursor = collection
            .find(query)
            .await?;
        let requests = cursor.try_collect::<Vec<Request>>().await?;

        // let cursor = collection.find(query, None).await?;
        // let statuses = cursor.try_collect::<Vec<Request>>().await?;
        Ok(requests.len() > 0)
    }

    pub async fn insert_one(&self, request: &Request) -> OracleResult<()> {
        if request.statuses.is_empty() {
            return Err(OracleError::CommonError("Request must have at least one status".to_string()));
        }

        let mechanism = request.statuses[0].status_mechanism;
        let collection = self.collections.get(&mechanism).unwrap();

        collection.insert_one(request).await?;
        Ok(())
    }
}